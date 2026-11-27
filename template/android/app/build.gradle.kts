plugins {
    alias(libs.plugins.android.application)
}

val releaseVersionCode = providers.environmentVariable("NAKOKIT_ANDROID_VERSION_CODE").orElse("1").get().toInt()
val releaseVersionName = providers.environmentVariable("NAKOKIT_ANDROID_VERSION_NAME").orElse("0.1.0").get()
val keystorePath = providers.environmentVariable("NAKOKIT_ANDROID_KEYSTORE").orNull

android {
    namespace = "moe.nakode.nakokit"
    compileSdk = 37

    defaultConfig {
        applicationId = "moe.nakode.nakokit"
        minSdk = 29
        targetSdk = 37
        versionCode = releaseVersionCode
        versionName = releaseVersionName
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = providers.environmentVariable("NAKOKIT_ANDROID_KEYSTORE_PASSWORD").get()
                keyAlias = providers.environmentVariable("NAKOKIT_ANDROID_KEY_ALIAS").get()
                keyPassword = providers.environmentVariable("NAKOKIT_ANDROID_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.browser)

    testImplementation(libs.junit)
}
