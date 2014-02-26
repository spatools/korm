define(["require", "exports", "jquery"], function(require, exports, $) {
    var isInitialized = false;

    function initialize() {
        if (!isInitialized) {
            $.ajaxPrefilter(function (options, originalOptions, jqXHR) {
                if (!originalOptions.retryCount || originalOptions.retryCount < 2 || originalOptions.retryDelay === 0) {
                    return;
                }

                if (originalOptions.retries) {
                    originalOptions.retries++;
                } else {
                    originalOptions.retries = 1;
                    originalOptions._error = originalOptions.error;
                }

                options.error = function (_jqXHR, _textStatus, _errorThrown) {
                    if (originalOptions.retries >= originalOptions.retryCount) {
                        if (originalOptions._error)
                            originalOptions._error(_jqXHR, _textStatus, _errorThrown);
                        return;
                    }

                    setTimeout(function () {
                        $.ajax(originalOptions);
                    }, originalOptions.retryDelay || 0);
                };
            });

            isInitialized = true;
        }
    }
    exports.initialize = initialize;
});
