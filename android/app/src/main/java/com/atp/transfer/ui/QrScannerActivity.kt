package com.atp.transfer.ui

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.ImageButton
import androidx.appcompat.app.AppCompatActivity
import com.atp.transfer.R
import com.journeyapps.barcodescanner.BarcodeCallback
import com.journeyapps.barcodescanner.BarcodeResult
import com.journeyapps.barcodescanner.CaptureManager
import com.journeyapps.barcodescanner.DecoratedBarcodeView

class QrScannerActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_SCAN_RESULT = "scan_result"
    }

    private lateinit var barcodeView: DecoratedBarcodeView
    private lateinit var captureManager: CaptureManager
    private var isTorchOn = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_qr_scanner)

        barcodeView = findViewById(R.id.barcode_scanner)
        val btnBack = findViewById<ImageButton>(R.id.btn_back)
        val btnTorch = findViewById<ImageButton>(R.id.btn_torch)

        btnBack.setOnClickListener {
            setResult(Activity.RESULT_CANCELED)
            finish()
        }

        btnTorch.setOnClickListener {
            isTorchOn = !isTorchOn
            if (isTorchOn) {
                barcodeView.setTorchOn()
                btnTorch.setImageResource(R.drawable.ic_flash_off)
            } else {
                barcodeView.setTorchOff()
                btnTorch.setImageResource(R.drawable.ic_flash_on)
            }
        }

        captureManager = CaptureManager(this, barcodeView)
        captureManager.initializeFromIntent(intent, savedInstanceState)
        captureManager.decode()

        barcodeView.decodeSingle(object : BarcodeCallback {
            override fun barcodeResult(result: BarcodeResult?) {
                result?.text?.let { scannedText ->
                    val resultIntent = Intent().apply {
                        putExtra(EXTRA_SCAN_RESULT, scannedText)
                    }
                    setResult(Activity.RESULT_OK, resultIntent)
                    finish()
                }
            }
        })
    }

    override fun onResume() {
        super.onResume()
        captureManager.onResume()
    }

    override fun onPause() {
        super.onPause()
        captureManager.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        captureManager.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        captureManager.onSaveInstanceState(outState)
    }
}
