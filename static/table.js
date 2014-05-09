(function($) {

    /**
     * jQuery UI widget that creates a sortable, row-selectable table.
     */

    $.widget("ui.table", {
        /**
         * Columns specifies a list of column headers. 
         * Click specifies a map from column number to click event handlers.
         * CaseInsensitive specifies case sensitivity for column sorting. 
         */
        options: { columns: [], caseInsensitive: true, click: {} },

        /**
         * Create a table widget by adding widget classes to the element, and
         * adding a table element as child. If options specifies 'data' or
         * 'url' attributes, pass these to the load and ajax methods
         * respectively.
         */
        _create: function () {
            var self = this;
            this.element.addClass("ui-widget ui-widget-content ui-corner-all");
            this.table = $("<table>");
            if (this.options.select != null) {
                this.table.addClass("selectable");
            }
            this.element.append(this.table);
            var row = $("<tr>");
            for (var i in this.options.columns) {
                var header = $("<th>").append($("<span>")).append(this.options.columns[i]);
                row.append(header.addClass("column" + i));
            }
            this.table.append(row);
            var spans = $("span", this.table);
            spans.direction({ "join": spans });
            spans.direction("option", "change", function(event, item) {
                self.sort(item.id - 1, item.value);
            });
            if (this.options.data != null) {
                this.load(this.options.data);
            }
            if (this.options.url != null) {
                this.ajax(this.options.url);
            }
            this._sort = null;
            var self = this;
            $("html").click(function (event) {
                if (self.options.select != null && ! self.options.nounselect) {
                    self.clearSelected(event);
                }
            });
        },
        
        /**
         * Method for fetching data via AJAX from the given URL. The 'data'
         * parameter specifies request data in the usual way. Attributes of
         * the options object specify:
         *
         *  data - use this attribute of the response object as table data
         *  pre  - apply this function to the data before loading the table
         *  post - apply this function to the data after loading the table
         */
        ajax: function (url, data, options) {
            var self = this;
            this._rows().remove();
            self._trigger("busystart");
            if (options == null) {
                options = {};
            }
            $.getJSON(url, data, function (data) {
                if (options.pre != null) {
                    options.pre(data);
                }
                self._trigger("busyend");
                if (options.data != null) {
                    self.load(data[options.data]);
                } else {
                    self.load(data);
                }
                if (options.post != null) {
                    options.post(data);
                }
            });
        },
        
        /**
         * This method loads the table from JSON formatted data:
         *
         *   [ { data: "column 1 data", metadata: "column 1 metadata" },
         *     { data: "column 2 data", metadata: "column 2 metadata" },
         *     ..
         *   ]
         *
         * If options.onloadselect is true, then after loading the first row
         * is selected.
         *
         * Also see 'add' method.
         */
        load: function (json) {
            this._rows().remove();
            var self = this;
            $.each(json, function() {
                self.add(this.data, this.metadata);
            });
            if (this.options.onloadselect) {
                $("tr", this.table).eq(1).click();
            }
        },
        
        /**
         * Method for adding a new row to the table with given data and
         * metadata.
         *
         * If options.classFn is set, then this function is applied to the
         * data and metadata, and the returned CSS class applied to the row.
         *
         * The data and metadata are stored on the row using the jQuery data
         * function with keys "data" and "metadata".
         */
        add: function (data, metadata) {
            var row = $("<tr>");
            row.data("data", data);
            row.data("metadata", metadata);
            if (this.options.classFn != null) {
                row.addClass(this.options.classFn(data, metadata));
            }
            row.disableSelection();
            var self = this;
            row.click(function (event) {
                if (self.options.select != null) {
                    if (self.options.select) {
                        row.toggleClass("selected");
                        var selected = $("tr.selected", self.table);
                        self._trigger("selection", event, { count: selected.length });
                    } else {
                        if (row.hasClass("selected")) {
                            if (! self.options.nounselect) {
                                row.removeClass("selected");
                            }
                        } else {
                            $("tr.selected", self.table).removeClass("selected");
                            row.addClass("selected");
                            self._trigger("selection", event, row.data("data"), row.data("metadata"));
                        }
                    }
                    return false;
                }
            });
            var table = this.table;
            var self = this;
            for (var i in data) {
                var td = $("<td>");
                td.addClass("column" + i);
                if (this.options.click[i] != null) {
                    td.addClass("link");
                    function f(i) {
                        return function (event) { self.options.click[i](event, row) };
                    };
                    td.click(f(i));
                }
                td.append($("<span>").html(data[i]));
                row.append(td);
            }
            table.append(row);
            if (this._sort != null) {
                this.sort(this._sort[0], this._sort[1]);
            }
            return row;
        },
        
        // return jQuery array of data rows (i.e. all but header row)
        _rows: function () {
            return $("tr", this.table).slice(1);
        },
        
        /**
         * Change data and metadata for a row, and reapply dependant functions.
         */
        editRow: function (row, data, metadata) {
            if (this.options.classFn != null) {
                row.removeClass(this.options.classFn(row.data("data"), row.data("metadata")));
            }
            if (data == null) {
                data = row.data("data");
            } else {
                row.data("data", data);
                for (var i in data) {
                    var span = $("td.column" + i + " span", row);
                    td.html(data[i]);
                }
                if (this._sort != null) {
                    this.sort(this._sort[0], this._sort[1]);
                }
            }
            if (metadata == null) {
                metadata = row.data("metadata");
            } else {
                row.data("metadata", metadata);
            }
            if (this.options.classFn != null) {
                row.addClass(this.options.classFn(row.data("data"), row.data("metadata")));
            }
        },
        
        /**
         * Set whether rows are selectable: null for no selection, flase for
         * single selection, and true for multi selection.
         */
        setSelect: function (select) {
            this.options.select = select;
        },

        /**
         * Remove selected rows from the table. Triggers a selection event.
         */        
        removeSelected: function (event) {
            var selected = $("tr.selected", this.table);
            if (selected.length > 0) {
                selected.each(function () {
                    $(this).remove();
                });
                this._trigger("selection", event, { count: 0 });
            }
        },
        
        /**
         * Apply the given function to each selected row (data, metadata).
         */
        eachSelectedData: function (fn) {
            $("tr.selected", this.table).each(function () {
                fn($(this).data("data"), $(this).data("metadata"));
            });
        },
        
        /**
         * Apply the given function to each selected row.
         */
        eachSelectedRow: function (fn) {
            $("tr.selected", this.table).each(function () {
                fn($(this));
            });
        },

        /**
         * Clear the current selection. Triggers a selection event.
         */
        clearSelected: function (event) {
            var selected = $("tr.selected", this.table);
            if (selected.length > 0) {
                selected.removeClass("selected");
                this._trigger("selection", event, { count: 0 });
            }
        },
        
        /**
         * Clear rows from the table.
         */
        clear: function () {
            this._rows().remove();
        },
        
        /**
         * Sort table rows by the specified column and direction.
         */
        sort: function (column, direction) {
            if (column != null && direction != null) {
                this._sort = [column, direction];
            } else if (this._sort == null) {
                return;
            } else {
                column = this._sort[0];
                direction = this._sort[1];
            }
            var rows = this._rows();
            var insensitive = this.options.caseInsensitive;
            rows.sort(function (a, b) {
                var x = $("td.column" + column + " span", a).html();
                var y = $("td.column" + column + " span", b).html();
                if (insensitive) {
                    x = x.toLowerCase();
                    y = y.toLowerCase();
                }
                var intX = parseInt(x), intY = parseInt(y);
                if (! isNaN(intX) && ! isNaN(intY)) {
                    x = intX;
                    y = intY;
                }
                return -direction * (x > y ? 1 : x < y ? -1 : 0);
            });
            rows.detach();
            this.table.append(rows);
        },

        /**
         * Restore original element state.
         */
        destroy: function () {
            $.Widget.prototype.destroy.call(this);
            this.element.removeClass("ui-widget ui-widget-content ui-corner-all");
            this.table.remove();
        }
    });
})(jQuery);

