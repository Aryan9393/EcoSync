.class public Lorg/ecosync/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

# EcoSync Android shell: a full-screen WebView that opens launch.html, which forwards
# to the EcoSync server. Grants camera/GPS to the page and supports <input type=file>.

.field public fileCb:Landroid/webkit/ValueCallback;
.field public web:Landroid/webkit/WebView;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 7
    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    const v1, -0xf5f5f6

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V
    iput-object v0, p0, Lorg/ecosync/app/MainActivity;->web:Landroid/webkit/WebView;
    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v2
    const/4 v3, 0x1
    const/4 v4, 0x0
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setDatabaseEnabled(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setGeolocationEnabled(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setJavaScriptCanOpenWindowsAutomatically(Z)V
    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    invoke-virtual {v2}, Landroid/webkit/WebSettings;->getUserAgentString()Ljava/lang/String;
    move-result-object v5
    const-string v6, " EcoSyncAndroid/1.0"
    invoke-virtual {v5, v6}, Ljava/lang/String;->concat(Ljava/lang/String;)Ljava/lang/String;
    move-result-object v5
    invoke-virtual {v2, v5}, Landroid/webkit/WebSettings;->setUserAgentString(Ljava/lang/String;)V

    new-instance v2, Lorg/ecosync/app/Client;
    invoke-direct {v2, p0}, Lorg/ecosync/app/Client;-><init>(Lorg/ecosync/app/MainActivity;)V
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v2, Lorg/ecosync/app/Chrome;
    invoke-direct {v2, p0}, Lorg/ecosync/app/Chrome;-><init>(Lorg/ecosync/app/MainActivity;)V
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    invoke-virtual {p0, v0}, Lorg/ecosync/app/MainActivity;->setContentView(Landroid/view/View;)V

    const/4 v2, 0x3
    new-array v2, v2, [Ljava/lang/String;
    const-string v3, "android.permission.CAMERA"
    const/4 v4, 0x0
    aput-object v3, v2, v4
    const-string v3, "android.permission.ACCESS_FINE_LOCATION"
    const/4 v4, 0x1
    aput-object v3, v2, v4
    const-string v3, "android.permission.RECORD_AUDIO"
    const/4 v4, 0x2
    aput-object v3, v2, v4
    const/4 v4, 0x1
    invoke-virtual {p0, v2, v4}, Lorg/ecosync/app/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    const-string v2, "file:///android_asset/www/launch.html"
    invoke-virtual {v0, v2}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    return-void
.end method

.method public onBackPressed()V
    .locals 2
    iget-object v0, p0, Lorg/ecosync/app/MainActivity;->web:Landroid/webkit/WebView;
    if-eqz v0, :super
    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z
    move-result v1
    if-eqz v1, :super
    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V
    return-void
    :super
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V
    return-void
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 2
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    const/4 v0, 0x2
    if-ne p1, v0, :end
    iget-object v0, p0, Lorg/ecosync/app/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v0, :end
    invoke-static {p2, p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->parseResult(ILandroid/content/Intent;)[Landroid/net/Uri;
    move-result-object v1
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    const/4 v1, 0x0
    iput-object v1, p0, Lorg/ecosync/app/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    :end
    return-void
.end method
