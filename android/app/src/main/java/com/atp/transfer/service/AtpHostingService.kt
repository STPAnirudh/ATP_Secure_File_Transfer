package com.atp.transfer.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.atp.transfer.AtpApplication
import com.atp.transfer.R
import com.atp.transfer.server.AtpHttpServer
import com.atp.transfer.server.AtpTcpServer
import com.atp.transfer.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

class AtpHostingService : Service() {

    companion object {
        private const val TAG = "AtpHostingService"
        const val NOTIFICATION_ID = 9001

        const val ACTION_START = "com.atp.transfer.action.START_HOSTING"
        const val ACTION_STOP = "com.atp.transfer.action.STOP_HOSTING"

        private val _isServerRunning = MutableStateFlow(false)
        val isServerRunning = _isServerRunning.asStateFlow()

        private val _serverIp = MutableStateFlow("127.0.0.1")
        val serverIp = _serverIp.asStateFlow()

        private val _activeConnections = MutableStateFlow(0)
        val activeConnections = _activeConnections.asStateFlow()

        fun startService(context: Context) {
            val intent = Intent(context, AtpHostingService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopService(context: Context) {
            val intent = Intent(context, AtpHostingService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var tcpServer: AtpTcpServer? = null
    private var httpServer: AtpHttpServer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var monitorJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                Log.i(TAG, "Received ACTION_STOP")
                stopHosting()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START, null -> {
                Log.i(TAG, "Received ACTION_START")
                startHosting()
            }
        }
        return START_STICKY
    }

    private fun startHosting() {
        if (_isServerRunning.value) {
            Log.d(TAG, "Hosting is already running.")
            return
        }

        try {
            // 1. Enter foreground immediately with persistent notification
            val notification = buildNotification(AtpHttpServer.getLocalIpAddress(), 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }

            // 2. Acquire PowerManager WakeLock
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ATP:HostingWakeLock"
            ).apply {
                acquire(24 * 60 * 60 * 1000L) // up to 24 hours
            }

            // 3. Acquire WifiLock (LOW_LATENCY for Android 10+ to maintain socket response in screen-off)
            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            val lockMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                WifiManager.WIFI_MODE_FULL_LOW_LATENCY
            } else {
                @Suppress("DEPRECATION")
                WifiManager.WIFI_MODE_FULL_HIGH_PERF
            }
            wifiLock = wifiManager.createWifiLock(lockMode, "ATP:HostingWifiLock").apply {
                acquire()
            }

            // 4. Resolve storage directory (prefer app-specific external files so users can inspect if needed, fallback to internal files)
            val baseDir = getExternalFilesDir(null) ?: filesDir
            val atpStorageDir = File(baseDir, "atp").apply { if (!exists()) mkdirs() }

            // 5. Start ATP TCP Server (Port 9000)
            tcpServer = AtpTcpServer(port = 9000, storageDir = atpStorageDir).apply {
                start()
            }

            // 6. Start ATP HTTP Server (Port 8000)
            httpServer = AtpHttpServer(
                httpPort = 8000,
                tcpPort = 9000,
                context = applicationContext,
                storageDir = atpStorageDir
            ).apply {
                start()
            }

            val ip = AtpHttpServer.getLocalIpAddress()
            _serverIp.value = ip
            _isServerRunning.value = true

            // 7. Update notification with real IP
            updateNotification(ip, 0)

            // 8. Launch monitoring loop for connection tracking and notification updates
            monitorJob = serviceScope.launch {
                while (isActive && _isServerRunning.value) {
                    val activeCount = tcpServer?.activeConnectionsCount ?: 0
                    _activeConnections.value = activeCount
                    val currentIp = AtpHttpServer.getLocalIpAddress()
                    if (currentIp != _serverIp.value) {
                        _serverIp.value = currentIp
                        updateNotification(currentIp, activeCount)
                    }
                    delay(3000)
                }
            }

            Log.i(TAG, "ATP Hosting successfully active on http://$ip:8000 (TCP :9000)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start hosting service: ${e.message}", e)
            stopHosting()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun stopHosting() {
        monitorJob?.cancel()
        monitorJob = null

        try {
            tcpServer?.stop()
            tcpServer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping TCP server: ${e.message}")
        }

        try {
            httpServer?.stop()
            httpServer = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping HTTP server: ${e.message}")
        }

        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            wakeLock = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WakeLock: ${e.message}")
        }

        try {
            if (wifiLock?.isHeld == true) wifiLock?.release()
            wifiLock = null
        } catch (e: Exception) {
            Log.e(TAG, "Error releasing WifiLock: ${e.message}")
        }

        _isServerRunning.value = false
        _activeConnections.value = 0
        Log.i(TAG, "ATP Hosting Service fully shut down")
    }

    private fun buildNotification(ip: String, connections: Int): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("tab", "host")
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val stopIntent = Intent(this, AtpHostingService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val contentText = "http://$ip:8000 • Active clients: $connections"

        return NotificationCompat.Builder(this, AtpApplication.CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(getString(R.string.notification_server_running))
            .setContentText(contentText)
            .setStyle(NotificationCompat.BigTextStyle().bigText("Hosting ATP Node at http://$ip:8000\nEncrypted TCP Port: 9000\nActive clients: $connections"))
            .setOngoing(true)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, getString(R.string.action_stop), stopPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun updateNotification(ip: String, connections: Int) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification(ip, connections))
    }

    override fun onDestroy() {
        stopHosting()
        super.onDestroy()
    }
}
