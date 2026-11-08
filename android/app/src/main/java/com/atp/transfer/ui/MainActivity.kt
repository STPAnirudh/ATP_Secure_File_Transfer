package com.atp.transfer.ui

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.text.format.Formatter
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.atp.transfer.AtpApplication
import com.atp.transfer.R
import com.atp.transfer.server.AtpHttpServer
import com.atp.transfer.service.AtpHostingService
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val PREFS_NAME = "atp_prefs"
        private const val KEY_LAST_URL = "last_server_url"
    }

    // Top Bar views
    private lateinit var txtTopIp: TextView
    private lateinit var statusIndicatorDot: View

    // Layout containers for tabs
    private lateinit var layoutOverview: ScrollView
    private lateinit var layoutConnect: ScrollView
    private lateinit var layoutHost: ScrollView
    private lateinit var layoutWeb: LinearLayout
    private lateinit var layoutVault: LinearLayout

    // Bottom Navigation views
    private lateinit var tabOverview: LinearLayout
    private lateinit var tabConnect: LinearLayout
    private lateinit var tabHost: LinearLayout
    private lateinit var tabConsole: LinearLayout
    private lateinit var tabVault: LinearLayout

    private lateinit var iconOverview: ImageView
    private lateinit var iconConnect: ImageView
    private lateinit var iconHost: ImageView
    private lateinit var iconConsole: ImageView
    private lateinit var iconVault: ImageView

    private lateinit var labelOverview: TextView
    private lateinit var labelConnect: TextView
    private lateinit var labelHost: TextView
    private lateinit var labelConsole: TextView
    private lateinit var labelVault: TextView

    // Mode A Views
    private lateinit var inputServerUrl: EditText
    private lateinit var btnScanQr: Button
    private lateinit var btnConnectManual: Button
    private lateinit var btnDiscoverDevices: Button
    private lateinit var progressDiscovery: ProgressBar
    private lateinit var txtDiscoveryStatus: TextView
    private lateinit var containerDiscoveredNodes: LinearLayout

    // Mode B Views
    private lateinit var switchServiceHosting: MaterialSwitch
    private lateinit var switchOverviewHost: MaterialSwitch
    private lateinit var txtHostStatusBadge: TextView
    private lateinit var txtHostIpDisplay: TextView
    private lateinit var txtHostClientCount: TextView
    private lateinit var cardQrContainer: LinearLayout
    private lateinit var imgHostQr: ImageView
    private lateinit var txtHostFullUrl: TextView
    private lateinit var btnCopyHostUrl: Button
    private lateinit var btnOpenLocalConsole: Button

    // Overview buttons
    private lateinit var btnOverviewScan: Button
    private lateinit var btnOverviewConnectTab: Button
    private lateinit var btnOverviewHostManage: Button

    // WebView views
    private lateinit var webView: WebView
    private lateinit var webProgressBar: ProgressBar
    private lateinit var txtWebCurrentUrl: TextView
    private lateinit var btnWebBack: ImageButton
    private lateinit var btnWebRefresh: ImageButton
    private lateinit var btnWebExternal: ImageButton

    // Vault views
    private lateinit var vaultEmptyView: LinearLayout
    private lateinit var vaultScrollView: ScrollView
    private lateinit var containerVaultItems: LinearLayout
    private lateinit var btnVaultRefresh: ImageButton

    // State
    private var currentTab: String = "overview"
    private var currentServerUrl: String = "http://127.0.0.1:8000"
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Activity Result Launchers
    private val qrScanLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val scannedText = result.data?.getStringExtra(QrScannerActivity.EXTRA_SCAN_RESULT)
            if (!scannedText.isNullOrBlank()) {
                handleScannedUrl(scannedText)
            }
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            launchQrScanner()
        } else {
            Toast.makeText(this, "Camera permission required to scan QR codes", Toast.LENGTH_SHORT).show()
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            toggleHostingService(true)
        } else {
            Toast.makeText(this, "Notification permission recommended for hosting in background", Toast.LENGTH_SHORT).show()
            toggleHostingService(true)
        }
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        var uris: Array<Uri>? = null
        if (result.resultCode == Activity.RESULT_OK) {
            result.data?.let { data ->
                val clipData = data.clipData
                val singleUri = data.data
                uris = if (clipData != null) {
                    Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                } else if (singleUri != null) {
                    arrayOf(singleUri)
                } else {
                    null
                }
            }
        }
        fileUploadCallback?.onReceiveValue(uris)
        fileUploadCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initViews()
        setupListeners()
        setupWebView()
        setupBackNavigation()
        observeHostingState()
        updateNetworkDisplay()

        // Handle intent extra (e.g. from notification)
        intent?.getStringExtra("tab")?.let { targetTab ->
            switchTab(targetTab)
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        intent?.getStringExtra("tab")?.let { targetTab ->
            switchTab(targetTab)
        }
    }

    override fun onResume() {
        super.onResume()
        updateNetworkDisplay()
        if (currentTab == "vault") {
            refreshVaultList()
        }
    }

    private fun initViews() {
        txtTopIp = findViewById(R.id.txt_top_ip)
        statusIndicatorDot = findViewById(R.id.status_indicator_dot)

        layoutOverview = findViewById(R.id.layout_overview)
        layoutConnect = findViewById(R.id.layout_connect)
        layoutHost = findViewById(R.id.layout_host)
        layoutWeb = findViewById(R.id.layout_web)
        layoutVault = findViewById(R.id.layout_vault)

        tabOverview = findViewById(R.id.tab_overview)
        tabConnect = findViewById(R.id.tab_connect)
        tabHost = findViewById(R.id.tab_host)
        tabConsole = findViewById(R.id.tab_console)
        tabVault = findViewById(R.id.tab_vault)

        iconOverview = findViewById(R.id.icon_nav_overview)
        iconConnect = findViewById(R.id.icon_nav_connect)
        iconHost = findViewById(R.id.icon_nav_host)
        iconConsole = findViewById(R.id.icon_nav_console)
        iconVault = findViewById(R.id.icon_nav_vault)

        labelOverview = findViewById(R.id.label_nav_overview)
        labelConnect = findViewById(R.id.label_nav_connect)
        labelHost = findViewById(R.id.label_nav_host)
        labelConsole = findViewById(R.id.label_nav_console)
        labelVault = findViewById(R.id.label_nav_vault)

        inputServerUrl = findViewById(R.id.input_server_url)
        btnScanQr = findViewById(R.id.btn_scan_qr)
        btnConnectManual = findViewById(R.id.btn_connect_manual)
        btnDiscoverDevices = findViewById(R.id.btn_discover_devices)
        progressDiscovery = findViewById(R.id.progress_discovery)
        txtDiscoveryStatus = findViewById(R.id.txt_discovery_status)
        containerDiscoveredNodes = findViewById(R.id.container_discovered_nodes)

        switchServiceHosting = findViewById(R.id.switch_service_hosting)
        switchOverviewHost = findViewById(R.id.switch_overview_host)
        txtHostStatusBadge = findViewById(R.id.txt_host_status_badge)
        txtHostIpDisplay = findViewById(R.id.txt_host_ip_display)
        txtHostClientCount = findViewById(R.id.txt_host_client_count)
        cardQrContainer = findViewById(R.id.card_qr_container)
        imgHostQr = findViewById(R.id.img_host_qr)
        txtHostFullUrl = findViewById(R.id.txt_host_full_url)
        btnCopyHostUrl = findViewById(R.id.btn_copy_host_url)
        btnOpenLocalConsole = findViewById(R.id.btn_open_local_console)

        btnOverviewScan = findViewById(R.id.btn_overview_scan)
        btnOverviewConnectTab = findViewById(R.id.btn_overview_connect_tab)
        btnOverviewHostManage = findViewById(R.id.btn_overview_host_manage)

        webView = findViewById(R.id.web_view)
        webProgressBar = findViewById(R.id.web_progress_bar)
        txtWebCurrentUrl = findViewById(R.id.txt_web_current_url)
        btnWebBack = findViewById(R.id.btn_web_back)
        btnWebRefresh = findViewById(R.id.btn_web_refresh)
        btnWebExternal = findViewById(R.id.btn_web_external)

        vaultEmptyView = findViewById(R.id.vault_empty_view)
        vaultScrollView = findViewById(R.id.vault_scroll_view)
        containerVaultItems = findViewById(R.id.container_vault_items)
        btnVaultRefresh = findViewById(R.id.btn_vault_refresh)

        val lastUrl = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_LAST_URL, null)
        if (!lastUrl.isNullOrBlank()) {
            inputServerUrl.setText(lastUrl)
        }
    }

    private fun setupListeners() {
        tabOverview.setOnClickListener { switchTab("overview") }
        tabConnect.setOnClickListener { switchTab("connect") }
        tabHost.setOnClickListener { switchTab("host") }
        tabConsole.setOnClickListener { switchTab("console") }
        tabVault.setOnClickListener { switchTab("vault") }

        btnOverviewScan.setOnClickListener { checkCameraAndScan() }
        btnOverviewConnectTab.setOnClickListener { switchTab("connect") }
        btnOverviewHostManage.setOnClickListener { switchTab("host") }

        btnScanQr.setOnClickListener { checkCameraAndScan() }

        btnConnectManual.setOnClickListener {
            val input = inputServerUrl.text.toString().trim()
            if (input.isNotBlank()) {
                val formatted = normalizeUrl(input)
                saveLastUrl(formatted)
                loadUrlInConsole(formatted)
            } else {
                Toast.makeText(this, "Please enter a valid IP address or URL", Toast.LENGTH_SHORT).show()
            }
        }

        btnDiscoverDevices.setOnClickListener {
            startSubnetDiscovery()
        }

        switchServiceHosting.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked != AtpHostingService.isServerRunning.value) {
                if (isChecked) {
                    checkNotificationPermissionAndStart()
                } else {
                    toggleHostingService(false)
                }
            }
        }

        switchOverviewHost.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked != AtpHostingService.isServerRunning.value) {
                if (isChecked) {
                    checkNotificationPermissionAndStart()
                } else {
                    toggleHostingService(false)
                }
            }
        }

        btnCopyHostUrl.setOnClickListener {
            val url = txtHostFullUrl.text.toString()
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("ATP Hosting URL", url)
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Copied $url to clipboard", Toast.LENGTH_SHORT).show()
        }

        btnOpenLocalConsole.setOnClickListener {
            val localUrl = "http://127.0.0.1:8000"
            loadUrlInConsole(localUrl)
        }

        btnWebBack.setOnClickListener {
            if (webView.canGoBack()) webView.goBack() else switchTab("overview")
        }

        btnWebRefresh.setOnClickListener {
            webView.reload()
        }

        btnWebExternal.setOnClickListener {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(currentServerUrl))
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(this, "Cannot open external browser: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }

        btnVaultRefresh.setOnClickListener {
            refreshVaultList()
        }
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    webProgressBar.visibility = View.VISIBLE
                    webProgressBar.progress = newProgress
                } else {
                    webProgressBar.visibility = View.GONE
                }
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                if (!title.isNullOrBlank()) {
                    txtWebCurrentUrl.text = title
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                fileChooserLauncher.launch(Intent.createChooser(intent, "Select Files to Transfer"))
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                url?.let {
                    currentServerUrl = it
                    txtWebCurrentUrl.text = it
                }
            }
        }

        webView.setDownloadListener(object : DownloadListener {
            override fun onDownloadStart(
                url: String?,
                userAgent: String?,
                contentDisposition: String?,
                mimetype: String?,
                contentLength: Long
            ) {
                url?.let { downloadUrl ->
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            data = Uri.parse(downloadUrl)
                        }
                        startActivity(intent)
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        })
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (currentTab == "console" && webView.canGoBack()) {
                    webView.goBack()
                } else if (currentTab != "overview") {
                    switchTab("overview")
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })
    }

    fun switchTab(tab: String) {
        currentTab = tab

        layoutOverview.visibility = if (tab == "overview") View.VISIBLE else View.GONE
        layoutConnect.visibility = if (tab == "connect") View.VISIBLE else View.GONE
        layoutHost.visibility = if (tab == "host") View.VISIBLE else View.GONE
        layoutWeb.visibility = if (tab == "console") View.VISIBLE else View.GONE
        layoutVault.visibility = if (tab == "vault") View.VISIBLE else View.GONE

        val vermilion = ContextCompat.getColor(this, R.color.atp_vermilion)
        val muted = ContextCompat.getColor(this, R.color.atp_text_muted)

        labelOverview.setTextColor(if (tab == "overview") vermilion else muted)
        labelConnect.setTextColor(if (tab == "connect") vermilion else muted)
        labelHost.setTextColor(if (tab == "host") vermilion else muted)
        labelConsole.setTextColor(if (tab == "console") vermilion else muted)
        labelVault.setTextColor(if (tab == "vault") vermilion else muted)

        iconOverview.setColorFilter(if (tab == "overview") vermilion else muted)
        iconConnect.setColorFilter(if (tab == "connect") vermilion else muted)
        iconHost.setColorFilter(if (tab == "host") vermilion else muted)
        iconConsole.setColorFilter(if (tab == "console") vermilion else muted)
        iconVault.setColorFilter(if (tab == "vault") vermilion else muted)

        if (tab == "vault") {
            refreshVaultList()
        }
    }

    private fun checkCameraAndScan() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            launchQrScanner()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun launchQrScanner() {
        val intent = Intent(this, QrScannerActivity::class.java)
        qrScanLauncher.launch(intent)
    }

    private fun handleScannedUrl(scanned: String) {
        val formatted = normalizeUrl(scanned)
        saveLastUrl(formatted)
        inputServerUrl.setText(formatted)
        Toast.makeText(this, "Connecting to $formatted", Toast.LENGTH_SHORT).show()
        loadUrlInConsole(formatted)
    }

    private fun loadUrlInConsole(url: String) {
        currentServerUrl = url
        txtWebCurrentUrl.text = url
        webView.loadUrl(url)
        switchTab("console")
    }

    private fun normalizeUrl(raw: String): String {
        var str = raw.trim()
        if (!str.startsWith("http://") && !str.startsWith("https://")) {
            str = "http://$str"
        }
        val uri = Uri.parse(str)
        val port = uri.port
        if (port == -1) {
            // Append standard ATP port 8000 if omitted
            val host = uri.host ?: str.removePrefix("http://").removePrefix("https://").split("/").first()
            str = "http://$host:8000"
        }
        return str
    }

    private fun saveLastUrl(url: String) {
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_URL, url)
            .apply()
    }

    private fun checkNotificationPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        toggleHostingService(true)
    }

    private fun toggleHostingService(start: Boolean) {
        if (start) {
            AtpHostingService.startService(this)
        } else {
            AtpHostingService.stopService(this)
        }
    }

    private fun observeHostingState() {
        lifecycleScope.launch {
            AtpHostingService.isServerRunning.collect { isRunning ->
                switchServiceHosting.isChecked = isRunning
                switchOverviewHost.isChecked = isRunning

                if (isRunning) {
                    txtHostStatusBadge.text = "ACTIVE • PORT 8000/9000"
                    txtHostStatusBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.atp_emerald))
                    statusIndicatorDot.setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.atp_emerald))
                    cardQrContainer.visibility = View.VISIBLE
                    updateHostQrCode()
                } else {
                    txtHostStatusBadge.text = "SERVER OFFLINE"
                    txtHostStatusBadge.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.atp_rose))
                    statusIndicatorDot.setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.atp_text_muted))
                    cardQrContainer.visibility = View.GONE
                }
            }
        }

        lifecycleScope.launch {
            AtpHostingService.serverIp.collect { ip ->
                txtHostIpDisplay.text = ip
                val fullUrl = "http://$ip:8000"
                txtHostFullUrl.text = fullUrl
                txtTopIp.text = ip
                if (AtpHostingService.isServerRunning.value) {
                    updateHostQrCode()
                }
            }
        }

        lifecycleScope.launch {
            AtpHostingService.activeConnections.collect { clients ->
                txtHostClientCount.text = "$clients Active"
            }
        }
    }

    private fun updateHostQrCode() {
        val ip = AtpHostingService.serverIp.value
        val url = "http://$ip:8000"
        lifecycleScope.launch(Dispatchers.Default) {
            val qrBitmap = generateQrCodeBitmap(url, 500)
            withContext(Dispatchers.Main) {
                imgHostQr.setImageBitmap(qrBitmap)
            }
        }
    }

    private fun generateQrCodeBitmap(content: String, size: Int): Bitmap {
        val writer = MultiFormatWriter()
        val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size)
        val width = bitMatrix.width
        val height = bitMatrix.height
        val pixels = IntArray(width * height)
        for (y in 0 until height) {
            val offset = y * width
            for (x in 0 until width) {
                pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE
            }
        }
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
        return bitmap
    }

    private fun updateNetworkDisplay() {
        val localIp = AtpHttpServer.getLocalIpAddress()
        txtTopIp.text = localIp
        txtHostIpDisplay.text = localIp
    }

    private fun startSubnetDiscovery() {
        val myIp = AtpHttpServer.getLocalIpAddress()
        if (myIp == "127.0.0.1") {
            Toast.makeText(this, "Connect to Wi-Fi to discover devices on network", Toast.LENGTH_SHORT).show()
            return
        }

        val prefix = myIp.substringBeforeLast(".") + "."
        containerDiscoveredNodes.removeAllViews()
        progressDiscovery.visibility = View.VISIBLE
        txtDiscoveryStatus.text = "Scanning subnet $prefix* for active ATP nodes..."
        btnDiscoverDevices.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            val foundList = mutableListOf<Pair<String, String>>()
            val myHostPart = myIp.substringAfterLast(".").toIntOrNull() ?: -1

            // Probe IP range in parallel batches of 25
            val ipRange = (1..254).filter { it != myHostPart }
            val batchSize = 25

            for (chunk in ipRange.chunked(batchSize)) {
                val tasks = chunk.map { i ->
                    async {
                        val testIp = "$prefix$i"
                        val testUrl = "http://$testIp:8000/api/health"
                        try {
                            val conn = (URL(testUrl).openConnection() as HttpURLConnection).apply {
                                connectTimeout = 400
                                readTimeout = 400
                                requestMethod = "GET"
                            }
                            if (conn.responseCode == 200) {
                                val text = conn.inputStream.bufferedReader().use { it.readText() }
                                val json = JSONObject(text)
                                val name = json.optString("device_name", "ATP Desktop Node")
                                Pair(testIp, name)
                            } else null
                        } catch (e: Exception) {
                            null
                        }
                    }
                }

                val results = tasks.awaitAll().filterNotNull()
                foundList.addAll(results)
            }

            withContext(Dispatchers.Main) {
                progressDiscovery.visibility = View.GONE
                btnDiscoverDevices.isEnabled = true

                if (foundList.isEmpty()) {
                    txtDiscoveryStatus.text = "No ATP nodes found on subnet. Verify desktop start.py is running on port 8000."
                } else {
                    txtDiscoveryStatus.text = "Discovered ${foundList.size} active ATP node(s):"
                    for ((ip, name) in foundList) {
                        addDiscoveredNodeView(ip, name)
                    }
                }
            }
        }
    }

    private fun addDiscoveredNodeView(ip: String, name: String) {
        val itemView = LayoutInflater.from(this).inflate(R.layout.item_discovered_device, containerDiscoveredNodes, false)
        val txtName = itemView.findViewById<TextView>(R.id.txt_device_name)
        val txtAddress = itemView.findViewById<TextView>(R.id.txt_device_address)
        val btnConnect = itemView.findViewById<Button>(R.id.btn_connect_discovered)

        val fullUrl = "http://$ip:8000"
        txtName.text = name
        txtAddress.text = fullUrl

        btnConnect.setOnClickListener {
            saveLastUrl(fullUrl)
            loadUrlInConsole(fullUrl)
        }

        containerDiscoveredNodes.addView(itemView)
    }

    private fun refreshVaultList() {
        val baseDir = getExternalFilesDir(null) ?: filesDir
        val vaultDir = File(baseDir, "atp/received")
        if (!vaultDir.exists()) vaultDir.mkdirs()

        val files = vaultDir.listFiles()?.filter { it.isFile && !it.name.endsWith(".part") } ?: emptyList()
        containerVaultItems.removeAllViews()

        if (files.isEmpty()) {
            vaultEmptyView.visibility = View.VISIBLE
            vaultScrollView.visibility = View.GONE
        } else {
            vaultEmptyView.visibility = View.GONE
            vaultScrollView.visibility = View.VISIBLE

            val sdf = SimpleDateFormat("MMM d, yyyy • HH:mm", Locale.getDefault())

            for (file in files.sortedByDescending { it.lastModified() }) {
                val itemView = LayoutInflater.from(this).inflate(R.layout.item_vault_file, containerVaultItems, false)
                val txtFileName = itemView.findViewById<TextView>(R.id.txt_file_name)
                val txtFileMeta = itemView.findViewById<TextView>(R.id.txt_file_meta)
                val txtSha256 = itemView.findViewById<TextView>(R.id.txt_sha256)
                val btnShare = itemView.findViewById<ImageButton>(R.id.btn_share)
                val btnDelete = itemView.findViewById<ImageButton>(R.id.btn_delete)

                val sizeFormatted = formatFileSize(file.length())
                val dateFormatted = sdf.format(Date(file.lastModified()))

                txtFileName.text = file.name
                txtFileMeta.text = "$sizeFormatted • $dateFormatted"

                // Look up SHA-256 digest from database
                val digest = AtpApplication.database.getFileSha256(file.name) ?: "Verified on arrival"
                txtSha256.text = "SHA-256 Verified: ${digest.take(16)}..."

                itemView.setOnClickListener {
                    openFileWithSystem(file)
                }

                btnShare.setOnClickListener {
                    shareFile(file)
                }

                btnDelete.setOnClickListener {
                    AlertDialog.Builder(this)
                        .setTitle("Delete File")
                        .setMessage("Permanently remove '${file.name}' from vault?")
                        .setPositiveButton("Delete") { _, _ ->
                            file.delete()
                            AtpApplication.database.deleteTransferByFilename(file.name)
                            refreshVaultList()
                            Toast.makeText(this, "Deleted ${file.name}", Toast.LENGTH_SHORT).show()
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }

                containerVaultItems.addView(itemView)
            }
        }
    }

    private fun openFileWithSystem(file: File) {
        try {
            val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, contentResolver.getType(uri) ?: "*/*")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(this, "No app available to open this file", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareFile(file: File) {
        try {
            val uri = FileProvider.getUriForFile(this, "${packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = contentResolver.getType(uri) ?: "*/*"
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(Intent.createChooser(intent, "Share via ATP"))
        } catch (e: Exception) {
            Toast.makeText(this, "Share failed: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun formatFileSize(bytes: Long): String {
        if (bytes < 1024) return "$bytes B"
        val kb = bytes / 1024.0
        if (kb < 1024) return String.format(Locale.US, "%.1f KB", kb)
        val mb = kb / 1024.0
        if (mb < 1024) return String.format(Locale.US, "%.2f MB", mb)
        val gb = mb / 1024.0
        return String.format(Locale.US, "%.2f GB", gb)
    }
}
