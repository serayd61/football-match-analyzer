plugins {
    id("com.android.application")
}

// Google Play build of footballanalytics.pro as a plain Android WebView app
// (2026-10-10). It replaces the Bubblewrap TWA (android-twa/): a TWA renders
// the site inside Chrome, so Play's closed-test engagement check saw no usage
// inside the app. Same applicationId and upload key, versionCode +1, so Play
// treats it as an ordinary update of the existing app.
android {
    namespace = "pro.footballanalytics"
    compileSdk = 36

    defaultConfig {
        applicationId = "pro.footballanalytics"   // never change: Play identity
        minSdk = 24
        targetSdk = 36
        versionCode = 2          // TWA release was 1
        versionName = "1.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signing happens outside Gradle (sign-release.sh) so no password
            // ever lives in this file or in the Gradle cache.
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures { buildConfig = true }

    bundle {
        language { enableSplit = false }
    }
}

dependencies {
    // Aligns the kotlin-stdlib-jdk7/jdk8 shims pulled in by old AndroidX libs with kotlin-stdlib.
    implementation(platform("org.jetbrains.kotlin:kotlin-bom:1.8.22"))
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
