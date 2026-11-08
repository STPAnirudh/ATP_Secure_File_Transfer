package com.atp.transfer

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.atp.transfer.db.AtpDatabase
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.Security

class AtpApplication : Application() {

    companion object {
        const val CHANNEL_ID = "atp_hosting_channel"
        lateinit var instance: AtpApplication
            private set

        val database: AtpDatabase by lazy {
            AtpDatabase(instance)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Register Bouncy Castle provider for X25519 and HKDF
        setupCryptoProvider()

        // Create persistent notification channel for hosting service
        createNotificationChannel()
    }

    private fun setupCryptoProvider() {
        val existing = Security.getProvider(BouncyCastleProvider.PROVIDER_NAME)
        if (existing == null) {
            Security.addProvider(BouncyCastleProvider())
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = getString(R.string.notification_channel_name)
            val descriptionText = getString(R.string.notification_channel_desc)
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                setShowBadge(false)
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
}
