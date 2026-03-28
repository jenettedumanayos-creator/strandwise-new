(function () {
    function ensureShell() {
        let overlay = document.getElementById('appUiOverlay');
        if (overlay) {
            return overlay;
        }

        overlay = document.createElement('div');
        overlay.id = 'appUiOverlay';
        overlay.className = 'app-ui-overlay';
        overlay.innerHTML = [
            '<div class="app-ui-modal" role="dialog" aria-modal="true" aria-live="polite">',
            '  <div class="app-ui-header"><h3 class="app-ui-title" id="appUiTitle">Notice</h3></div>',
            '  <div class="app-ui-body">',
            '    <p class="app-ui-message" id="appUiMessage"></p>',
            '    <div class="app-ui-input-wrap" id="appUiInputWrap" style="display:none;">',
            '      <label class="app-ui-label" id="appUiLabel" for="appUiInput"></label>',
            '      <input class="app-ui-input" id="appUiInput" type="text" />',
            '    </div>',
            '  </div>',
            '  <div class="app-ui-footer">',
            '    <button class="app-ui-btn app-ui-btn-secondary" id="appUiCancelBtn" type="button">Cancel</button>',
            '    <button class="app-ui-btn app-ui-btn-primary" id="appUiConfirmBtn" type="button">OK</button>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        const toastStack = document.createElement('div');
        toastStack.id = 'appUiToastStack';
        toastStack.className = 'app-ui-toast-stack';
        document.body.appendChild(toastStack);

        return overlay;
    }

    function openDialog(options) {
        const overlay = ensureShell();
        const title = overlay.querySelector('#appUiTitle');
        const message = overlay.querySelector('#appUiMessage');
        const inputWrap = overlay.querySelector('#appUiInputWrap');
        const label = overlay.querySelector('#appUiLabel');
        const input = overlay.querySelector('#appUiInput');
        const cancelBtn = overlay.querySelector('#appUiCancelBtn');
        const confirmBtn = overlay.querySelector('#appUiConfirmBtn');

        title.textContent = options.title || 'Notice';
        message.textContent = options.message || '';

        confirmBtn.textContent = options.confirmText || 'OK';
        cancelBtn.textContent = options.cancelText || 'Cancel';

        const withInput = Boolean(options.input);
        const withCancel = Boolean(options.cancel);

        inputWrap.style.display = withInput ? '' : 'none';
        cancelBtn.style.display = withCancel ? '' : 'none';

        if (withInput) {
            label.textContent = options.input.label || 'Value';
            input.value = options.input.value || '';
            input.placeholder = options.input.placeholder || '';
            setTimeout(function () { input.focus(); input.select(); }, 0);
        } else {
            setTimeout(function () { confirmBtn.focus(); }, 0);
        }

        overlay.classList.add('open');

        return new Promise(function (resolve) {
            function cleanup() {
                overlay.classList.remove('open');
                confirmBtn.removeEventListener('click', onConfirm);
                cancelBtn.removeEventListener('click', onCancel);
                overlay.removeEventListener('click', onBackdropClick);
                document.removeEventListener('keydown', onKeyDown);
            }

            function onConfirm() {
                const val = withInput ? input.value : true;
                cleanup();
                resolve({ ok: true, value: val });
            }

            function onCancel() {
                cleanup();
                resolve({ ok: false, value: null });
            }

            function onBackdropClick(evt) {
                if (evt.target === overlay && withCancel) {
                    onCancel();
                }
            }

            function onKeyDown(evt) {
                if (evt.key === 'Escape' && withCancel) {
                    evt.preventDefault();
                    onCancel();
                    return;
                }

                if (evt.key === 'Enter' && (!withInput || document.activeElement === input)) {
                    evt.preventDefault();
                    onConfirm();
                }
            }

            confirmBtn.addEventListener('click', onConfirm);
            cancelBtn.addEventListener('click', onCancel);
            overlay.addEventListener('click', onBackdropClick);
            document.addEventListener('keydown', onKeyDown);
        });
    }

    function toast(message, type, duration) {
        ensureShell();
        const stack = document.getElementById('appUiToastStack');
        if (!stack) return;

        const item = document.createElement('div');
        item.className = 'app-ui-toast app-ui-toast-' + (type || 'info');
        item.textContent = message;
        stack.appendChild(item);

        const ttl = Number.isFinite(duration) ? duration : 3200;
        window.setTimeout(function () {
            item.remove();
        }, ttl);
    }

    window.AppUI = {
        alert: function (message, title) {
            return openDialog({
                title: title || 'Notice',
                message: message,
                confirmText: 'OK',
                cancel: false
            }).then(function () { return undefined; });
        },
        confirm: function (message, title, confirmText, cancelText) {
            return openDialog({
                title: title || 'Confirm',
                message: message,
                confirmText: confirmText || 'OK',
                cancelText: cancelText || 'Cancel',
                cancel: true
            }).then(function (result) { return result.ok; });
        },
        prompt: function (labelText, defaultValue, title) {
            return openDialog({
                title: title || 'Input Required',
                message: '',
                input: {
                    label: labelText || 'Value',
                    value: defaultValue || ''
                },
                confirmText: 'OK',
                cancelText: 'Cancel',
                cancel: true
            }).then(function (result) {
                return result.ok ? result.value : null;
            });
        },
        toast: toast
    };
})();
