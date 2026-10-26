import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

private val localProperties: Properties =
    Properties().apply {
        val f = rootProject.file("local.properties")
        if (f.exists()) f.inputStream().use { load(it) }
    }

/** local.properties first, then environment (same key name), for CI or shell-driven builds. */
private fun localPropOrEnv(propertyKey: String): String {
    val fromFile = localProperties.getProperty(propertyKey, "")?.trim().orEmpty()
    if (fromFile.isNotEmpty()) return fromFile
    return System.getenv(propertyKey)?.trim().orEmpty()
}

private fun escapeForBuildConfigString(s: String): String =
    buildString {
        for (c in s) {
            when (c) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> Unit
                else -> append(c)
            }
        }
    }

android {
    namespace = "dev.weekdayfuel.app"
    compileSdk = 35

    signingConfigs {
        getByName("debug") {
            val envPath = System.getenv("WEEKDAY_FUEL_SHARED_DEBUG_KEYSTORE")
            val propPath = localProperties.getProperty("debug.storeFile")
            val keystoreFile =
                when {
                    !envPath.isNullOrBlank() -> file(envPath)
                    !propPath.isNullOrBlank() -> file(propPath)
                    else -> null
                }
            if (keystoreFile != null && keystoreFile.isFile) {
                val storePass =
                    localProperties.getProperty("debug.storePassword")
                        ?: System.getenv("WEEKDAY_FUEL_SHARED_DEBUG_STORE_PASSWORD")
                val alias =
                    localProperties.getProperty("debug.keyAlias")
                        ?: System.getenv("WEEKDAY_FUEL_SHARED_DEBUG_KEY_ALIAS")
                val keyPass =
                    localProperties.getProperty("debug.keyPassword")
                        ?: System.getenv("WEEKDAY_FUEL_SHARED_DEBUG_KEY_PASSWORD")
                if (!storePass.isNullOrBlank() && !alias.isNullOrBlank() && !keyPass.isNullOrBlank()) {
                    storeFile = keystoreFile
                    storePassword = storePass
                    keyAlias = alias
                    keyPassword = keyPass
                }
            }
        }
    }

    defaultConfig {
        applicationId = "dev.weekdayfuel.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 55
        versionName = "0.32.2"
        // GitHub Releases updater (checked on cold start). CI / downloaded APKs have no local.properties,
        // so default to the public releases repo. Forks: set UPDATE_GITHUB_* in local.properties or env.
        val updateOwner = escapeForBuildConfigString(
            localPropOrEnv("UPDATE_GITHUB_OWNER").ifEmpty { "Evzy" },
        )
        val updateRepo = escapeForBuildConfigString(
            localPropOrEnv("UPDATE_GITHUB_REPO").ifEmpty { "weekday-fuel-releases" },
        )
        val updateToken = escapeForBuildConfigString(localPropOrEnv("UPDATE_GITHUB_TOKEN"))
        buildConfigField("String", "UPDATE_GITHUB_OWNER", "\"$updateOwner\"")
        buildConfigField("String", "UPDATE_GITHUB_REPO", "\"$updateRepo\"")
        buildConfigField("String", "UPDATE_GITHUB_TOKEN", "\"$updateToken\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.core.ktx)
    implementation(libs.activity.ktx)
    implementation(libs.lifecycle.runtime.ktx)
    implementation(libs.webkit)
    testImplementation(libs.junit)
    testImplementation(libs.org.json)
}
