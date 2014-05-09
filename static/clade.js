$(function () {
    /**
     * Fetch document data and suggested keywords via AJAX. The argument 'data'
     * is an object with possible attributes 'add', 'remove', 'toggle' for
     * keyword operations, and 'id' for identifying the category. If 'rankWas'
     * is true, the document ranking is passed to rank_docs so that the 'was'
     * column is populated.
     */
    var getDocuments = function (data, rankWas) {
        $("#documents").table("ajax", "/ajax/documents", data, { data: "docs", pre: function (resp) {
            $("#suggestions").table("ajax", "/ajax/suggestions", { id: data.id });
            // ranking is stored in jQuery data on the #documents element
            var oldRank = rankWas ? $("#documents").data("rank") : null;
            $("#documents").data("rank", rank_docs(resp.docs, oldRank));
            // update document count on current node and in category title
            var word = resp.count == 1 ? " document" : " documents";
            var node = $("#tree").jstree("get_selected");
            $("a", node).eq(0).attr("title", resp.count + word);
            $("#category .count").text(resp.count + word);
        }});
    };

    /**
     * Called when a keyword is edited, added, removed, or toggled, to update
     * the category on the server and repopulate the documents and suggested
     * keywords panels.
     */
    var keyword = function (data) {
        // convert singletons to arrays, and prune ""s
        for (var key in data) {
            if (! $.isArray(data[key])) {
                data[key] = [data[key]];
            }
            for (var i in data[key]) {
                if (data[key][i] == "") {
                    data[key].splice(i, 1);
                }
            }
            if (data[key].length == 0) {
                delete data[key];
            }
        }
        if (data.length == 0) {
            return;
        }
        data.id = $("#tree").jstree("get_selected").attr("id");
        getDocuments(data, true);
    };
    
    /**
     * Called after a keyword is edited.
     */
    var keywordChangeFn = function (event, ui) {
        // update keyword table row data
        ui.tr.data("data", [ ui.value ]);
        // re-allow multi-selection on the table
        $("#keywords").table("setSelect", true);
        // sort the column if a direction has been selected
        $("#keywords").table("sort");
        // find out if the new keyword value is already in the table
        var exists = false;
        $("#keywords td.column0").each(function () {
            if (ui.tr.get(0) !== $(this).parent().get(0) && $(this).text() == ui.value) {
                exists = true;
            }
        });
        $("#suggestions td.column0").each(function () {
            if ($(this).text() == ui.value) {
                $(this).parent().remove();
            }
        });
        if (ui.value == "" || exists) {
            // new value is empty or the keyword already exists: remove row
            ui.tr.remove();
            keyword({ remove: ui.old })
        } else if (ui.old != ui.value) {
            keyword({ remove: ui.old, add: ui.value })
        }
    };
    
    /**
     * Return a map from document id to rank in document set. If oldRank is
     * given, populate the 'was' column in the data.
     */
    function rank_docs(data, oldRank) {
        var docs = [];
        for (var i in data) {
            docs.push(data[i].data);
        }
        docs.sort(function (a, b) { return a[2] > b[2] ? -1 : a[2] < b[2] ? 1 : 0 });
        var rank = {};
        for (var i in docs) {
            rank[docs[i][0]] = parseInt(i) + 1;
        }
        for (var i in data) {
            var r0 = oldRank != null ? oldRank[data[i].data[0]] : "";
            var r1 = rank[data[i].data[0]];
            data[i].data = [data[i].data[0], data[i].data[1], r0, r1];
        }
        return rank;
    }
   
    /**
     * Taxonomy combo-box selection event handler. The 'item' argument is not
     * used. The 'taxonomy' argument is an object with possible attributes
     * 'valid' (boolean) and 'value' (the taxonomy index).
     */
    var taxonomySelectFn = function (item, taxonomy) {
        $("#delete, #rename").button("option", "disabled", ! taxonomy.valid);
        $("#create").button("option", "disabled", taxonomy.valid);
        $("#new_keyword").button("disable");
        $("#keywords, #suggestions, #documents").table("clear");
        $("#category .name, #category .count").text("");
        
        if (! taxonomy.valid) {
            // invalid taxonomy selection - reset panels to empty state
            $("#category .name, #category .count").text("");
            $("#tree").hide();
            $("#taxonomyIcons button").button("disable");
            return;
        }
        
        // we have a taxonomy selection - populate the tree
        $("#tree").jstree({
            "json_data": {
                "ajax": {
                    "url": "/ajax/taxonomy",
                    "data": function () {
                        return { value: taxonomy.value };
                    }
                }
            },
            "themes": {
                "theme" : "default",
                "dots" : false
            },
            "ui": {
                "select_limit" : 1,
                "selected_parent_close" : "select_parent"
            },
            "plugins": [ "themes", "json_data", "ui", "crrm" ]
        }).bind("select_node.jstree", function (event, data) {
            // category selection event handler
            $("#taxonomyIcons button").button("enable");
            // get category info from selected tree node
            var node = data.rslt.obj;
            var id = node.attr("id");
            // populate category title
            var title = node.children("a").eq(0);
            $("#category .name").text(title.text());
            // populate keywords panel via AJAX
            $("#keywords").table("ajax", "/ajax/keywords", { id: id }, { post: function () {
                $("#keywords td.column0 span").editable({ inputClass: "keywordInput", change: keywordChangeFn });
            }});
            $("#new_keyword").button("enable");
            // populate documents and suggested keywords panels via AJAX
            getDocuments({ id: id });
        }).bind("rename_node.jstree delete_node.jstree", function (event, data) {
            // category edit event handler - get category info from selected node
            var args = {};
            args.id = data.args[0].attr("id");
            args.name = data.args[1];
            args.parent_id = data.args[0].parents("li").attr("id");
            // update the server with changes - if a delete, args.name is null
            // if new category, args.id is null; otherwise, it's a name edit
            $.getJSON('/ajax/category', args, function (resp) {
                if (resp.error) {
                    alert(resp.error);
                } else if (resp.id) {
                    data.args[0].attr("id", resp.id);
                    $("a", data.args[0]).attr("title", resp.count);
                }
            });
        });
        $("#tree").show();
    };
    
    // set up the taxonomy combo box
    $.getJSON('/ajax/taxonomies', function(data) {
        var options = $("#taxonomies select");
        $.each(data, function() {
            options.append($("<option>").val(this.value).text(this.label));
        });
        $("#taxonomies input").autocomplete("search", "");
    });
    $("#taxonomies select").combobox();
    $("#taxonomies input").attr("title", "Taxonomy");
    $("#tree").hide();
    $("#taxonomy, #category, #title").addClass("ui-widget ui-widget-content ui-corner-left ui-corner-right");
    $("#taxonomies select").combobox("option", "select", taxonomySelectFn);
    // hack the combobox to be non-editable for now
    $("#taxonomies input").attr("readonly", "readonly");

    // set up create/rename/delete taxonomy buttons
    $("#create, #delete, #rename").button({ disabled: true });
    $("#dialog").dialog({ autoOpen: false, modal: true, resizable: false, width: 600 });
    var ok_fn = function (data, includeName) {
        // return a callback function to create/rename/delete taxonomy
        return function (event) {
            if (includeName) {
                data.name = $("#dialog input").val();
            }
            $.getJSON("/ajax/taxonomy", data, function (resp) {
                if (resp.error) {
                    alert(resp.error);
                } else if (resp.value != null && data.value == null) {
                    // create successful
                    $("#taxonomies select").append($("<option>").val(resp.value).text(data.name));
                    taxonomySelectFn(null, { valid: true, value: resp.value });
                } else if (resp.value != null) {
                    // rename successful
                    $("#taxonomies input").val(data.name);
                    $("#taxonomies select option").each(function () {
                        if ($(this).val() == data.value) {
                            $(this).text(data.name);
                        }
                    });
                    taxonomySelectFn(null, { valid: true, value: resp.value });
                } else {
                    // delete successful
                    $("#taxonomies select option").each(function () {
                        if ($(this).val() == data.value) {
                            $(this).remove();
                        }
                    });
                    $("#taxonomies input").val("");
                    taxonomySelectFn(null, { valid: false });
                }
            });
            close();
        }
    };
    var close = function () { $("#dialog").dialog("close") };
    $("#create").click(function() {
        // open the create taxonomy dialog, with a text input
        var name = $("#taxonomies select").combobox("label");
        $("#dialog").dialog("option", "title", "Create taxonomy");
        var html = "Create new taxonomy";
        if (name.length > 0) {
            html += "<i>" + name + "</i>";
        }
        html += "?";
        $("#dialog p").html(html);
        $("#dialog").dialog("option", "buttons", { "OK": ok_fn({}, true), "Cancel": close });
        $("#dialog input").val(name);
        $("#dialog label, #dialog input").show();
        $("#dialog").dialog("open");
    });
    $("#rename").click(function() {
        // open the rename taxonomy dialog, with a text input
        var name = $("#taxonomies select :selected").text();
        var value = $("#taxonomies select :selected").val();
        $("#dialog").dialog("option", "title", "Rename taxonomy");
        $("#dialog p").html("Rename taxonomy <i>" + name + "</i>?");
        $("#dialog").dialog("option", "buttons", { "OK": ok_fn({ value: value }, true), "Cancel": close });
        $("#dialog input").val(name);
        $("#dialog label, #dialog input").show();
        $("#dialog").dialog("open");
    });
    $("#delete").click(function() {
        // open the delete taxonomy dialog
        var name = $("#taxonomies select :selected").text();
        var value = $("#taxonomies select :selected").val();
        $("#dialog").dialog("option", "title", "Delete taxonomy");
        $("#dialog p").html("Delete taxonomy <i>" + name + "</i>?");
        $("#dialog").dialog("option", "buttons", { "OK": ok_fn({ value: value, remove: true }, false), "Cancel": close });
        $("#dialog label, #dialog input").hide();
        $("#dialog").dialog("open");
    });

    // set up taxonomy button bar
    var taxonomyIcons = $("<div>").attr("id", "taxonomyIcons").text("Taxonomy").prependTo("#taxonomy");
    var newNodeButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-plus" }, text: false }).attr("title", "New child category").click(function () {
        $("#tree").jstree("create", null, null, "New category");
    });
    var renameButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-pencil" }, text: false }).attr("title", "Rename node").click(function () {
        $("#tree").jstree("rename");
    });
    var deleteButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-close" }, text: false }).attr("title", "Delete node").click(function () {
        $("#tree").jstree("remove");
    });
    taxonomyIcons.append(deleteButton).append(renameButton).append(newNodeButton);
    
    // set up keywords panel, which allows multi-selection
    var classFn = function (data, metadata) {
        // apply positive/negative class to keywords appropriately
        return metadata ? "positive" : "negative";
    };
    var addButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-plus" }, text: false }).attr("title", "Add new keyword").attr("id", "new_keyword").click(function () {
        // add new keyword - add a new table row and put it in edit mode
        var tr = $("#keywords").table("setSelect", false).table("add", [""], true);
        var td = $("td.column0 span", tr);
        td.editable({ inputClass: "keywordInput", change: keywordChangeFn });
        td.editable("edit", { tr: tr });
    });
    var removeButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-close" }, text: false }).attr("title", "Remove keyword(s)").click(function () {
        // remove selected keywords - remove rows and update server
        var keywords = [];
        $("#keywords").table("eachSelectedData", function(data, metadata) {
            keywords.push(data[0]);
        }).table("removeSelected");
        keyword({ remove: keywords });        
        return false;
    });
    var editButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-pencil" }, text: false }).attr("title", "Edit keyword").click(function () {
        // edit selected keyword - disable row selection for now, and place selected row into edit mode
        $("#keywords").table("setSelect", false).table("eachSelectedRow", function(tr) {
            $("td.column0 span", tr).editable("edit", { tr: tr });
        });
    });
    var toggleButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-shuffle" }, text: false }).attr("title", "Toggle keyword(s)").click(function () {
        // toggle selected keywords - call editRow for each selected row, and update server
        var keywords = [];
        $("#keywords").table("eachSelectedRow", function(row) {
            var value = ! row.data("metadata");
            $("#keywords").table("editRow", row, null, value);
            keywords.push(row.data("data")[0]);
        });
        keyword({ toggle: keywords });
        return false;
    });
    var selectKeywords = function (event, data) {
        // keyword table row selection event handler
        var count = data["count"];
        if (count == 0) {
            // if no rows selected, only enable 'new keyword' button
            addButton.button("enable");
            removeButton.button("disable");
            editButton.button("disable");
            toggleButton.button("disable");
        } else if (count == 1) {
            // if one row selected, only enable 'remove', 'edit', 'toggle'
            $("#suggestions").table("clearSelected", event);
            addButton.button("disable");
            removeButton.button("enable");
            editButton.button("enable");
            toggleButton.button("enable");
        } else {
            // if many rows selected, ensure all enabled except 'new', 'edit
            editButton.button("disable");
        }
    };
    // set up keywords table with multi-selection and a busy-wait icon
    $("#keywords").table({ columns: ["Keyword"], classFn: classFn, select: true }).busy({ bind: "table" }).bind("tableselection", selectKeywords);
    // add buttons to header row
    $("#keywords th").append(removeButton).append(toggleButton).append(editButton).append(addButton);
    
    // set up suggested keywords panel
    var moveButton = $("<button>").button({ disabled: true, icons: { primary: "ui-icon-arrowreturnthick-1-w" }, text: false }).attr("title", "Move suggestion(s) to keywords").click(function (event) {
        // adopt suggestions event handler
        var keywords = [];
        $("#suggestions").table("eachSelectedData", function(data, metadata) {
            // add suggestion to the keywords table
            $("#keywords").table("add", data, metadata);
            keywords.push(data[0]);
        });
        // update keywords panel and get new documents and suggested keywords
        keyword({ add: keywords });
    });
    var selectSuggested = function (event, data) {
        // handler for selection of suggested keyword
        var count = data["count"];
        if (count == 0) {
            // if none selected, disable the 'adopt suggestions' button
            moveButton.button("disable");
        } else if (count == 1) {
            // if one becomes selected, show the 'adopt suggestions' button
            $("#keywords").table("clearSelected", event);
            moveButton.button("enable");
        }
    };
    // suggestions table with multi-selection and a busy-wait icon
    $("#suggestions").table({ columns: ["Suggested keyword"], select: true }).busy({ bind: "table" }).bind("tableselection", selectSuggested);
    $("#suggestions th").append(moveButton);
    
    // set up the category documents panel
    var docClickFn = function (event, tr) {
        // event handler for clicking on a document - switch view
        $("body > div").removeClass("catview").addClass("docview");
        var id = $("td.column0", tr).text();
        $("#title .id").text("#" + id);
        $("#back").removeAttr("disabled").click(function () {
            // back button - switch view
            $("body > div").removeClass("docview").addClass("catview");
            $(this).attr("disabled", true);
        });
        $("#document").highlight("clear");
        $("#dockeywords").table("clear");
        $("#ranked").table("clear");
        // get category id from selected tree node
        var catId = $("#tree").jstree("get_selected").attr("id");
        $("#document, #ranked").trigger("busystart");
        // populate document content panel via AJAX, and highlight keywords
        $.getJSON("/ajax/document", { id: id, term: catId }, function (data) {
            $("#document, #ranked").trigger("busyend");
            $("#document").data("id", id);
            var html = "<h1>" + data.title + "</h2>";
            html += data.text.replace(/\n\n/g, "</p><p>");
            $("#document").highlight("content", "<p>" + html + "</p>");
            // ... and then populate ranked category panel via AJAX
            $("#ranked").table("load", data.ranked);
        });
    };
    // category documents table with clickable entries
    $("#documents").table({ columns: ["ID", "Matching document", "Was", "Now"], click: { 0: docClickFn, 1: docClickFn } }).busy({ bind: "table" });
    
    // set up the document view
    $("#dockeywords").table({ columns: ["Keyword"] }).busy({ bind: "table" });
    $("#document").highlight().busy();
    // ranked category table allowing single selection (and not allowing unselection)
    $("#ranked").table({ columns: ["ID", "Category match", "Weight"], select: false, nounselect: true, onloadselect: true }).busy().bind("tableselection", function (event, id) {
        // event handler for category selection - populate keywords table via AJAX
        $("#dockeywords").table("ajax", "/ajax/keywords", { id: "term" + id }, { pre: function (data) {
            var keywords = [];
            for (var i in data) {
                keywords.push(data[i]["data"][0]);
            }
            // apply highlighting for document content
            $("#document").highlight("terms", keywords);
        }});
    });

    // display the page, and start in category view mode
    $("#help").addClass("ui-widget ui-widget-content ui-corner-all");
    $("body > div").addClass("catview");
    $("#back").attr("disabled", true);
    $("body").show();
});

