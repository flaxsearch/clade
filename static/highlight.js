(function($) {

    /**
     * jQuery UI widget that makes an element into a panel of text which can
     * have words highlighted by using the 'terms' method.
     */

    $.widget("ui.highlight", {
        options: {  },

        /**
         * Create the widget by adding widget classes to the element. No text
         * is displayed initially. If options.title is specified, it is used
         * as title text.
         */
        _create: function () {
            this.element.addClass("ui-widget ui-widget-content ui-corner-all");
            if (this.options.title != null) {
                this.element.append($("<span>").addClass("title").html(this.options.title));
            }
            this._html = $("<div>").appendTo(this.element);
            this._wrap = function (s) {
                return '<span class="highlight">' + s + '</span>';
            };
            this._content = "";
        },

        // highlight text in this._content by adding <span> elements around
        // matching words
        _highlight: function () {
            var html = this._content;
            if (this._terms != null) {
                for (var i in this._terms) {
                    html = html.replace(new RegExp("\\b" + this._terms[i] + "\\b", "gi"), this._wrap);
                }
            }
            this._html.html(html);
        },
        
        /**
         * Apply highlighting to the words in the given array.
         */
        terms: function (terms) {
            this._terms = terms;
            this._highlight();
        },
        
        /**
         * Remove highlighting from the given word.
         */
        remove: function (term) {
            var i = this._terms.indexOf(term);
            this._terms.splice(i, 1);
            this._highlight();
        },
        
        /**
         * Specify the text to be highlighted, and display it.
         */
        content: function (html) {
            this._content = html;
            this._highlight();
        },
        
        /**
         * Clear the text.
         */
        clear: function () {
            this._html.html("");
        },

        /**
         * Restore initial element state.
         */
        destroy: function () {
            this.element.removeClass("ui-widget ui-widget-content ui-corner-all");
            this.element.html("");
            $.Widget.prototype.destroy.call(this);
        }
    });
})(jQuery);

