package `in`.juspay.hyperota.ota

import java.util.concurrent.Callable
import java.util.concurrent.FutureTask

internal class WaitTask : FutureTask<Unit>(Callable {}) {
    fun complete() {
        super.set(Unit)
    }

    override fun run() {} // 'run' is disabled for this task.
}
