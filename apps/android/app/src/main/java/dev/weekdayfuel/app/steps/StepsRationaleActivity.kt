package dev.weekdayfuel.app.steps

import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import dev.weekdayfuel.app.R

/** Opened from Health Connect's privacy link: says what the app does with steps. */
class StepsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val pad = (24 * resources.displayMetrics.density).toInt()
        val text =
            TextView(this).apply {
                setText(R.string.steps_rationale)
                setTextColor(getColor(R.color.ink))
                textSize = 16f
                setPadding(pad, pad, pad, pad)
            }
        val root =
            ScrollView(this).apply {
                setBackgroundColor(getColor(R.color.page_background))
                addView(text)
            }
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.updatePadding(left = bars.left, top = bars.top, right = bars.right, bottom = bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }
}
