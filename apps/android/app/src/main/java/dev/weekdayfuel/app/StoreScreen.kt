package dev.weekdayfuel.app

import android.content.Context
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * "← Weekday Fuel" bar above a store's session WebView (Woolworths or Coles). When hidden it stays attached and visible underneath
 * the app page (z-order), because a hidden WebView throttles the session's scripts.
 */
class StoreScreen(
    context: Context,
    sessionView: WebView,
    private val appView: View,
    onClose: () -> Unit,
) {
    private val status =
        TextView(context).apply {
            setTextColor(context.getColor(R.color.ink))
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(0, 0, 32, 0)
        }

    val view: LinearLayout =
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(context.getColor(R.color.page_background))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            // Hidden underneath the app page, the store page must not take keyboard focus.
            descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
            val bar =
                LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    addView(
                        Button(context, null, android.R.attr.borderlessButtonStyle).apply {
                            text = context.getString(R.string.woolworths_back)
                            setTextColor(context.getColor(R.color.ink))
                            isAllCaps = false
                            setOnClickListener { onClose() }
                        },
                    )
                    addView(status, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
                }
            addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            addView(sessionView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        }

    var isShowing = false
        private set

    fun show() {
        isShowing = true
        view.descendantFocusability = ViewGroup.FOCUS_AFTER_DESCENDANTS
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        view.bringToFront()
    }

    fun hide() {
        isShowing = false
        setStatus(null)
        view.findFocus()?.clearFocus()
        view.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
        appView.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        view.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        appView.bringToFront()
    }

    fun setStatus(text: String?) {
        status.text = text.orEmpty()
    }
}
