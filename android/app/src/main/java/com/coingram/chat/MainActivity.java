package com.coingram.chat;

import com.getcapacitor.BridgeActivity;

import android.os.Bundle;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Disable the overscroll bounce/stretch effect
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        }
    }
}
