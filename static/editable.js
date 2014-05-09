(function($) {

    /**
     * jQuery UI widget for making the text of an element editable.
     */

    $.widget("ui.editable", {
        /**
         * The ui object is passed to event handlers (after filling in other
         * fields).
         */
        options: { ui: { } },

        /**
         * On creation, add an <input> element which starts hidden, and define
         * an event handler which will be bound later.
         */
        _create: function () {
            this.input = $("<input>").addClass(this.options.inputClass).hide();
            var self = this;
            this.fn = function (event) {
                // handle input events - if enter pressed or focus lost, edit
                // is finished, so unbind this event handler and trigger a
                // custom 'change' event
                if (event.type == "keypress" && event.keyCode != 13) {
                    return;
                }
                var text = self.input.val();
                self.input.unbind("focusout keypress", self.fn);
                self.input.hide();
                self.element.text(text);
                self.element.show();
                self.options.ui.value = text;
                self.options.ui.old = self._old;
                self._trigger("change", event, self.options.ui);
            };
            this.element.after(this.input);
        },

        /**
         * Method that puts the widget into 'edit' mode by hiding the original
         * element and showing the input. Event handlers are bound. If ui is
         * specified, it is passed to the event handler instead of the default
         * ui object.
         */
        edit: function (ui) {
            this._old = this.element.text();
            if (ui != null) {
                this.options.ui = ui;
            }
            this.input.bind("focusout keypress", this.fn);
            this.input.val(this._old).show();
            this.input.focus();
            this.input.val(this.input.val());
            this.element.hide();
        },

        /**
         * Return element to original state.
         */
        destroy: function() {
            this.input.remove();
            $.Widget.prototype.destroy.call(this);
        }
    });
})(jQuery);

