(function($) {

    /**
     * jQuery UI widget for making the element be a direction icon, possibly
     * linked to other direction icons for radio-button style operation.
     */

    $.widget("ui.direction", {
        /**
         * Default options (CSS properties).
         */
        options: { id: 0, value: 0, join: $(), classes: {
            "-1": "ui-icon-triangle-1-n",
             "0": "ui-icon-triangle-1-e",
             "1": "ui-icon-triangle-1-s"
        } },

        /**
         * Create the widget by adding UI button classes and adding a click
         * handler.
         */
        _create: function () {
            var self = this;
            this.id = this.options.id;
            this.element.css(this.options);
            this.element.addClass("ui-button ui-icon");
            this.value(this.options.value);
            this.join(this.options.join);
            this.element.click(function (event) {
                self.value(self._value == 0 ? -1 : -self._value);
                self._set.each(function () {
                    if (this == self.element[0]) return true;
                    $(this).direction("value", 0);
                });
                self._trigger("change", event, {
                    id: self.id,
                    value: self._value
                });
            });
        },
        
        /**
         * Method for setting the direction: -1, 0, or 1.  (0 indicates no
         * direction as such.)
         */
        value: function (value) {
            if (value != null) {
                if (this._value != null) {
                    this.element.removeClass(this.options.classes[this._value]);
                }
                this._value = value;
                this.element.addClass(this.options.classes[this._value]);
            }
            return this._value;
        },
        
        /**
         * Join this direction widget to others to form a set of radio-button
         * style buttons.
         */
        join: function (set) {
            this._set = set;
            var self = this;
            var index = 0;
            set.each(function () {
                index++;
                if (this == self.element[0]) {
                    self.id = index;
                }
            });
        },

        /**
         * Restore element to original state.
         */
        destroy: function() {
            this.element.removeClass("ui-button ui-icon");
            $.Widget.prototype.destroy.call(this);
        }
    });
})(jQuery);

