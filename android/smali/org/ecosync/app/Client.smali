.class public Lorg/ecosync/app/Client;
.super Landroid/webkit/WebViewClient;
.source "Client.java"

.field private final a:Lorg/ecosync/app/MainActivity;

.method public constructor <init>(Lorg/ecosync/app/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebViewClient;-><init>()V
    iput-object p1, p0, Lorg/ecosync/app/Client;->a:Lorg/ecosync/app/MainActivity;
    return-void
.end method

# Keep the app's own pages inside the WebView; send Google Maps, UPI apps, phone/email links out.
.method public shouldOverrideUrlLoading(Landroid/webkit/WebView;Ljava/lang/String;)Z
    .locals 3
    const-string v0, "file:"
    invoke-virtual {p2, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v0
    if-nez v0, :inapp
    const-string v0, "http"
    invoke-virtual {p2, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :external
    const-string v0, "google.com/maps"
    invoke-virtual {p2, v0}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z
    move-result v0
    if-nez v0, :external
    :inapp
    const/4 v0, 0x0
    return v0

    :external
    :try_start_0
    const-string v0, "intent:"
    invoke-virtual {p2, v0}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v0
    if-eqz v0, :view
    const/4 v0, 0x1
    invoke-static {p2, v0}, Landroid/content/Intent;->parseUri(Ljava/lang/String;I)Landroid/content/Intent;
    move-result-object v1
    goto :go
    :view
    new-instance v1, Landroid/content/Intent;
    const-string v0, "android.intent.action.VIEW"
    invoke-static {p2}, Landroid/net/Uri;->parse(Ljava/lang/String;)Landroid/net/Uri;
    move-result-object v2
    invoke-direct {v1, v0, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;Landroid/net/Uri;)V
    :go
    iget-object v0, p0, Lorg/ecosync/app/Client;->a:Lorg/ecosync/app/MainActivity;
    invoke-virtual {v0, v1}, Lorg/ecosync/app/MainActivity;->startActivity(Landroid/content/Intent;)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0
    :catch_0
    const/4 v0, 0x1
    return v0
.end method

# If the server can't be reached, show the launcher's offline screen.
.method public onReceivedError(Landroid/webkit/WebView;Landroid/webkit/WebResourceRequest;Landroid/webkit/WebResourceError;)V
    .locals 1
    invoke-interface {p2}, Landroid/webkit/WebResourceRequest;->isForMainFrame()Z
    move-result v0
    if-eqz v0, :end
    const-string v0, "file:///android_asset/www/launch.html#offline"
    invoke-virtual {p1, v0}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V
    :end
    return-void
.end method
