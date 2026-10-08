.class public Lorg/ecosync/app/Chrome;
.super Landroid/webkit/WebChromeClient;
.source "Chrome.java"

.field private final a:Lorg/ecosync/app/MainActivity;

.method public constructor <init>(Lorg/ecosync/app/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lorg/ecosync/app/Chrome;->a:Lorg/ecosync/app/MainActivity;
    return-void
.end method

# Camera / microphone for getUserMedia (the AI scanner and QR scanner)
.method public onPermissionRequest(Landroid/webkit/PermissionRequest;)V
    .locals 1
    invoke-virtual {p1}, Landroid/webkit/PermissionRequest;->getResources()[Ljava/lang/String;
    move-result-object v0
    invoke-virtual {p1, v0}, Landroid/webkit/PermissionRequest;->grant([Ljava/lang/String;)V
    return-void
.end method

# GPS for nearby hubs, pickups and litter reports
.method public onGeolocationPermissionsShowPrompt(Ljava/lang/String;Landroid/webkit/GeolocationPermissions$Callback;)V
    .locals 2
    const/4 v0, 0x1
    const/4 v1, 0x0
    invoke-interface {p2, p1, v0, v1}, Landroid/webkit/GeolocationPermissions$Callback;->invoke(Ljava/lang/String;ZZ)V
    return-void
.end method

# <input type="file"> photo uploads
.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3
    iget-object v0, p0, Lorg/ecosync/app/Chrome;->a:Lorg/ecosync/app/MainActivity;
    iget-object v1, v0, Lorg/ecosync/app/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    if-eqz v1, :set
    const/4 v2, 0x0
    invoke-interface {v1, v2}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :set
    iput-object p2, v0, Lorg/ecosync/app/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    :try_start_0
    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;
    move-result-object v1
    const/4 v2, 0x2
    invoke-virtual {v0, v1, v2}, Lorg/ecosync/app/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    const/4 v1, 0x1
    return v1
    :catch_0
    const/4 v1, 0x0
    iput-object v1, v0, Lorg/ecosync/app/MainActivity;->fileCb:Landroid/webkit/ValueCallback;
    const/4 v2, 0x0
    return v2
.end method
