/**
 *  Filemanager JS core
 *
 *  filemanager.js
 *
 *  @license    MIT License
 *  @author     Jason Huck - Core Five Labs
 *  @author     Simon Georget <simon (at) linea21 (dot) com>
 *  @author     Martin Aspeli
 *  @author     Nathan van Gheem
 *  @copyright  Authors
 */

jQuery(function($) {

    $().ready(function(){

        /*
         * Variables
         */

        // Elements we are controlling
        var fileManager = $("#filemanager");
        var fileTree = $("#filetree");
        var prompt = $("#pb_prompt");

        // Settings
        var editorHeight = 450;
        // XXX: Previous code to dynamically resize
        // var editorHeight = $(window).height() - $('#buttons').height() - 30;

        var editors = {};
        var nextEditorId = 0;

        var HTMLMode = require("ace/mode/html").Mode;
        var CSSMode  = require("ace/mode/css").Mode;
        var XMLMode  = require("ace/mode/xml").Mode;
        var JSMode   = require("ace/mode/javascript").Mode;
        var TextMode = require("ace/mode/text").Mode;

        var extensionModes = {
            css: new CSSMode(),
            js: new JSMode(),
            htm: new HTMLMode(),
            html: new HTMLMode(),
            xml: new XMLMode()
        };
        var defaultMode = new TextMode();

        var currentFolder = '/';

        /*
         * Helpers
         */

        // CSRF

        /**
          * Get the current CSRF authentication token
          */
        function getAuthenicator(){
            return $('input[name="_authenticator"]').eq(0).val();
        }

        /**
         * Input validation for filenames
         */
        function isValidFileName(name) {
            if(name == '')
                return false;

            return ! /[^\w\.\s\-]/gi.test(name);
        }


        // Prompt

        /**
         * Show modal prompt in an overlay
         *    options = {
         *        title: required title shown on prompt,
         *        description: description of modal,
         *        callback: called after button is clicked.
         *            Return false to prevent closing modal.
         *            Return a function to run after the modal has closed.
         *        showInput: boolean to show input
         *        inputValue: value input button should start with
         *        onBeforeLoad: method to be called before loading the modal prompt
         *    }
         */
        function showPrompt(options){
            if(options.description === undefined)  options.description = '';
            if(options.buttons === undefined)      options.buttons = ['OK'];
            if(options.callback === undefined)     options.callback = function(){};
            if(options.showInput === undefined)    options.showInput = false;
            if(options.inputValue === undefined)   options.inputValue = '';
            if(options.onBeforeLoad === undefined) options.onBeforeLoad = function(){};

            // Clear old values
            $('h1.documentFirstHeading,.documentDescription,.formControls', prompt).html('');
            $('.input', prompt).empty();
            if(options.showInput){
                $('.input', prompt).append('<input type="text" name="input" />');
                $('input[type="text"]', prompt).val(options.inputValue);
            }

            // Fill new values
            $('h1.documentFirstHeading', prompt).html(options.title);
            $('.documentDescription', prompt).html(options.description);
            for(var i = 0; i < options.buttons.length; ++i){
                var button = options.buttons[i];
                $('.formControls', prompt).append(
                    '<input class="context" type="submit" name="form.button.' +
                    button + '" value="' + button + '">');
            }
            options.onBeforeLoad();
            $('input[type="submit"]', prompt).click(function(){
                if(options.showInput){
                    result = options.callback($(this).val(), $('input[type="text"]', prompt).val());
                }else{
                    result = options.callback($(this).val());
                }
                if(result === false){
                    //cancel closing of form.
                    return false;
                }
                prompt.overlay().close();
                if(typeof(result) == 'function'){
                    result();
                }
                return false;
            });
            prompt.overlay().load();
        }

        // File tree

        /**
         * Get a node in the tree by path
         */
        function getNodeByPath(path) {
            return fileTree.dynatree("getTree").getNodeByKey(path);
        }

        /**
         * Get the currently selected folder in the file tree
         */
        function getCurrentFolder() {
            return getNodeByPath(currentFolder);
        }

        /**
         * Get the folder of the given node
         */
        function getFolder(node){
            if(!node.data.isFolder){
                node = node.parent;
            }
            return node;
        }

        // Editor


        /**
         * Set the height of the editor and file tree
         */
        function resizeEditor(){
            // editorHeight = $(window).height() - $('#buttons').height() - 30 - _previewHeight;
            $('#splitter, #fileeditor, .vsplitbar').height(editorHeight);
            fileTree.height(editorHeight-25);
            $('#fileeditor #editors li pre').height(editorHeight-32);
        }

        /**
         * Enable or disable the Save button depending on whether the current
         * file is dirty or not
         */
        function setSaveState(){
            var li = $("#fileselector li.selected");
            if(li.hasClass('dirty')){
                $("#save")[0].disabled = false;
            }else{
                $("#save")[0].disabled = true;
            }
        }

        /**
         * Close the tab for the given path
         */
        function removeTab(path) {
            var tabElement = $("#fileselector li[rel='" + path + "']");
            fileManager.trigger('resourceeditor.closed', path);
            if(tabElement.hasClass('selected') && tabElement.siblings("li").length > 0){
                var other = tabElement.prev("li");
                if(other.length == 0) {
                    other = tabElement.siblings("li").eq(0);
                }
                other.addClass('selected');
                $("#editors li[rel='" + other.attr('rel') + "']").addClass('selected');
                fileManager.trigger('resourceeditor.selected', other.attr('rel'));
            }
            $("#editors li[rel='" + path + "']").remove();
            tabElement.remove();
            setSaveState();
        }

        /**
         * Update references for any open tabs when path is moved/renamed to
         * newPath
         */
        function updateOpenTab(path, newPath) {
            $("#fileselector li[rel='" + path + "'] label").text(newPath);
            $("#fileselector li[rel='" + path + "']").attr('rel', newPath);
            $("#editors li[rel='" + path + "']").attr('rel', newPath);

            // Update the editors list
            if(path in editors) {
                editors[newPath] = editors[path];
                delete editors[path];
            }
        }

        // File operations

        /**
         * Open the file with the given path
         */
        function openFile(path){
            var relselector = 'li[rel="' + path + '"]';

            // Unselect current tab
            $("#fileselector li.selected, #editors li.selected").removeClass('selected');

            // Do we have this file already? If not ...
            if($('#fileselector ' + relselector).size() == 0) {

                // Create elements for the tab and close button
                var tab = $('<li class="selected" rel="' + path + '"><label>' + path + '</label></li>');
                var close = $('<a href="#close" class="closebtn"> x </a>');

                // Switch to the relevant tab when clicked
                tab.click(function(){
                    $("#fileselector li.selected,#editors li.selected").removeClass('selected');
                    $(this).addClass('selected');
                    $("#editors li[rel='" + $(this).attr('rel') + "']").addClass('selected');
                    setSaveState();
                    fileManager.trigger('resourceeditor.selected', path);

                    return false;
                });

                // Close the tab, prompting if there are unsaved changes, when
                // clicking the close button
                close.click(function(){
                    var tabElement = $(this).parent();
                    var path = tabElement.attr('rel');

                    // Are there unsaved changes?
                    var dirty = $('#fileselector li.selected').hasClass('dirty');
                    if(dirty){
                        showPrompt({
                            title: localizedMessages.prompt_unsavedchanges,
                            description: localizedMessages.prompt_unsavedchanges_desc,
                            buttons: [localizedMessages.yes, localizedMessages.no, localizedMessages.cancel],
                            callback: function(button){
                                if(button == localizedMessages.yes) {
                                    $("#save").trigger('click');
                                    removeTab(path);
                                } else if(button == localizedMessages.no) {
                                    removeTab(path);
                                }
                            }
                        });
                    } else {
                        removeTab(path);
                    }

                    return false;
                })

                // Add the tab and close elements to the page
                tab.append(close);
                $("#fileselector").append(tab);

                // Load the file from the server
                $.ajax({
                    url: BASE_URL + '/@@plone.resourceeditor.getfile',
                    data: {path: path},
                    dataType: 'json',
                    success: function(data){

                        var editorId = 'editor-' + nextEditorId++;
                        var editorListItem = $('<li class="selected" data-editorid="' + editorId + '" rel="' + path + '"></li>');

                        if(data.contents !== undefined){
                            var extension = data.ext;
                            var editorArea = $('<pre id="' + editorId + '" name="' + path + '">' + data.contents + '</pre>');
                            editorArea.height(editorHeight - 32);
                            editorListItem.append(editorArea);
                            $("#editors").append(editorListItem);

                            var mode = defaultMode;
                            if (extension in extensionModes) {
                                mode = extensionModes[extension];
                            }

                            function markDirty(){
                                $("#fileselector li[rel='" + path + "']").addClass('dirty');
                                setSaveState();
                            }

                            var editor = new SourceEditor(editorId, mode, data.contents, false, markDirty, true)
                            editors[path] = editor;

                            fileManager.trigger('resourceeditor.loaded', path);
                        } else{
                            editorListItem.append(data.info);
                            $("#editors").append(editorListItem);
                        }
                    }
                });
            }

            // Activate the given tab and editor
            $("#fileselector " + relselector + ", #editors " + relselector).addClass('selected');
            fileManager.trigger('resourceeditor.selected', path);
        }

        /**
         * Rename an item, prompting for a filename
         */
        function renameItem(node){
            var finalName = '';
            var path = node.data.key;

            showPrompt({
                title: localizedMessages.rename,
                description: localizedMessages.new_filename,
                buttons: [localizedMessages.rename, localizedMessages.cancel],
                inputValue: node.data.title,
                showInput: true,
                callback: function(button, rname){
                    if(button != localizedMessages.rename)
                        return;

                    var deferred = null;

                    if(rname == '') {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.no_filename
                            });
                        };
                    } else if(!isValidFileName(rname)) {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.invalid_filename
                            });
                        };
                    } else {
                        $.ajax({
                            type: 'POST',
                            url: FILE_CONNECTOR,
                            data: {
                                mode: 'rename',
                                old: path,
                                new: rname,
                                _authenticator: getAuthenicator()
                            },
                            dataType: 'json',
                            async: false,
                            success: function(result){
                                finalName = result['newName'];
                                if(result['code'] == 0){
                                    // Update the file tree
                                    var newParent = result['newParent'];
                                    var newName = result['newName'];

                                    var newPath = newParent + '/' + newName;

                                    node.data.title = newName;
                                    node.data.key = newPath;
                                    node.render();

                                    updateOpenTab(path, newPath);

                                } else {
                                    deferred = function() {
                                        showPrompt({
                                            title: localizedMessages.error,
                                            description: result['error']
                                        });
                                    };
                                }
                            }
                        });
                    }

                    return deferred;
                }
            });

            return finalName;
        }

        /**
         * Delete an item, prompting for confirmation
         */
        function deleteItem(node){
            var isDeleted = false;
            var path = node.data.key;

            showPrompt({
                title: localizedMessages.confirmation_delete,
                buttons: [localizedMessages.yes, localizedMessages.no],
                callback: function(button, value){
                    if(button != localizedMessages.yes)
                        return;

                    var deferred = null;

                    $.ajax({
                        type: 'POST',
                        url: FILE_CONNECTOR,
                        dataType: 'json',
                        data: {
                            mode: 'delete',
                            path: path,
                            _authenticator: getAuthenicator()
                        },
                        async: false,
                        success: function(result) {
                            if(result['code'] == 0){
                                removeTab(path);
                                node.remove();
                                isDeleted = true;
                            } else {
                                isDeleted = false;
                                deferred = function() {
                                    showPrompt({
                                        title: localizedMessages.error,
                                        description: result['error']
                                    });
                                };
                            }
                        }
                    });
                    return deferred;
                }
            });

            return isDeleted;
        }

        /**
         * Add a new blank file in the currently selected folder, prompting for file name.
         */
        function addNewFile(node){
            var filename = '';
            var path = node.data.key;

            showPrompt({
                title: localizedMessages.create_file,
                description: localizedMessages.prompt_filename,
                buttons: [localizedMessages.create_file, localizedMessages.cancel],
                inputValue: filename,
                showInput: true,
                callback: function(button, fname){
                    if(button != localizedMessages.create_file)
                        return;

                    var deferred = null;
                    if(fname == '') {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.no_filename
                            });
                        };
                    } else if(!isValidFileName(fname)) {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.invalid_filename
                            });
                        };
                    } else {
                        filename = fname;
                        $.ajax({
                            url: FILE_CONNECTOR,
                            data: {
                                mode: 'addnew',
                                path: path,
                                name: filename,
                                _authenticator: getAuthenicator()
                            },
                            async: false,
                            type: 'POST',
                            success: function(result){
                                if(result['code'] == 0){
                                    node.addChild({
                                        title: result['name'],
                                        key: result['parent'] + result['name']
                                    });
                                } else {
                                    deferred = function() {
                                        showPrompt({
                                            title: localizedMessages.error,
                                            description:result['error']
                                        });
                                    };
                                }
                            }
                        });
                    }
                    return deferred;
                }
            });
        }

        /**
         * Add a new folder, under the currently selected folder prompting for folder name
         */
        function addNewFolder(node){
            var foldername = '';
            var path = node.data.key;

            showPrompt({
                title: localizedMessages.create_folder,
                description: localizedMessages.prompt_foldername,
                buttons: [localizedMessages.create_folder, localizedMessages.cancel],
                inputValue: foldername,
                showInput: true,
                callback: function(button, fname){
                    if(button != localizedMessages.create_folder)
                        return;

                    var deferred = null;

                    if(fname == '') {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.no_foldername
                            });
                        };
                    } else if(!isValidFileName(fname)) {
                        deferred = function() {
                            showPrompt({
                                title: localizedMessages.error,
                                description: localizedMessages.invalid_foldername
                            });
                        };
                    } else {
                        foldername = fname;
                        $.ajax({
                            url: FILE_CONNECTOR,
                            data: {
                                mode: 'addfolder',
                                path: path,
                                name: foldername,
                                _authenticator: getAuthenicator()
                            },
                            async: false,
                            type: 'POST',
                            success: function(result){
                                if(result['code'] == 0){
                                    node.addChild({
                                        title: result['name'],
                                        key: result['parent'] + result['name'],
                                        isFolder: true
                                    });
                                } else {
                                    deferred = function() {
                                        showPrompt({
                                            title: localizedMessages.error,
                                            description: result['error']
                                        });
                                    };
                                }
                            }
                        })
                    }
                    return deferred
                }
            });
        }

        /**
         * Upload a new file to the current folder
         */
        function uploadFile(node){
            var form = null;
            var input = null;
            var path = node.data.key;

            if(path[0] == '/'){
                path = path.substring(1);
            }

            showPrompt({
                title: localizedMessages.upload,
                description: localizedMessages.prompt_fileupload,
                buttons: [localizedMessages.upload, localizedMessages.cancel],
                onBeforeLoad: function(){
                    if($('#fileselector li.selected').size() == 0){
                        $('input[value="' + localizedMessages.upload_and_replace_current + '"]', prompt).remove();
                    }
                    input = $('<input id="newfile" name="newfile" type="file" />');
                    form = $('<form method="post" action="' + FILE_CONNECTOR + '?mode=add"></form>');
                    form.append(input);
                    $('.input', prompt).append(form);
                    form.ajaxForm({
                        target: '#uploadresponse',
                        beforeSubmit: function(arr, form, options) {

                        },
                        data: {
                            currentpath: path,
                            _authenticator: getAuthenicator()
                        },
                        success: function(result){
                            prompt.overlay().close();
                            var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());

                            if(data['code'] == 0){
                                // XXX: Assumes we always add to current folder
                                getCurrentFolder().addChild({
                                    title: data['name'],
                                    key: data['name'],
                                    isFolder: false
                                });
                            } else {
                                showPrompt({
                                    title: localizedMessages.error,
                                    description: data['error']
                                });
                            }
                        },
                        forceSync: true
                    });
                },
                callback: function(button){
                    if(button == localizedMessages.cancel) {
                        return true;
                    }
                    form.trigger('submit');
                    return false;
                }
            });
        }

        /**
         * Binds contextual menus to items in list and grid views.
         */
        function bindMenus(span){
            $(span).contextMenu({menu: "itemOptions"}, function(action, el, pos) {
                // The event was bound to the <span> tag, but the node object
                // is stored in the parent <li> tag
                var node = $.ui.dynatree.getNode(el);
                switch(action) {
                    case "rename":
                        renameItem(node);
                        break;
                    case "delete":
                        deleteItem(node);
                        break;
                    case "newfolder":
                        addNewFolder(getFolder(node));
                        break;
                    case "addnew":
                        addNewFile(getFolder(node));
                        break;
                    case "upload":
                        uploadFile(getFolder(node));
                        break;
                    default:
                        break;
                }
            });
        }

        /**
         * Save the current file
         */
        function saveFile(path){
            var editor = editors[path];
            $.ajax({
                url: BASE_URL + '/@@plone.resourceeditor.savefile',
                data: {
                    path: path,
                    value: editor.getValue()
                },
                type: 'POST',
                success: function() {
                    $("#fileselector li[rel='" + path + "']").removeClass('dirty');
                    setSaveState();
                    fileManager.trigger('resourceeditor.saved', path);
                }
            });
        }

        /*
         * Initialization
         */

         // Warn before closing the page if there are changes
        window.onbeforeunload = function() {
            if($('#fileselector li.dirty').size() > 0){
                return localizedMessages.prompt_unsavedchanges;
            }
        };

        // Adjust layout.
        resizeEditor();
        $(window).resize(resizeEditor);

        // Set up key bindings for the editor
        var canon = require('pilot/canon');
        canon.addCommand({
            name: 'saveEditor',
            bindKey: {
                mac: 'Command-S',
                win: 'Ctrl-S',
                sender: 'editor'
            },
            exec: function(env, args, request) {
                var path = $("#fileselector li.selected").attr('rel');
                saveFile(path);
            }
        });

        // Set up overlay support
        prompt.overlay({
            mask: {
                color: '#dddddd',
                loadSpeed: 200,
                opacity: 0.9
            },
            // top : 0,
            fixed : false,
            closeOnClick: false
        });

        // Provides support for adjustible columns.
        $('#splitter').splitter({
            sizeLeft: 200
        });

        // cosmetic tweak for buttons
        $('button').wrapInner('<span></span>');

        // Bind toolbar buttons

        $('#addnew').click(function(){
            addNewFile(getCurrentFolder());
            return false;
        });

        $('#newfolder').click(function() {
            addNewFolder(getCurrentFolder());
            return false;
        });

        $("#upload").click(function(){
            uploadFile(getCurrentFolder());
            return false;
        });

        $("#save").click(function(){
            var path = $("#fileselector li.selected").attr('rel');
            saveFile(path);
            return false;
        });

        // Configure the file tree

        $("#filetree").dynatree({
            initAjax: {
              url: BASE_URL + '/@@plone.resourceeditor.filetree',
            },
            dnd: {
              autoExpandMS: 1000,
              preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
              onDragStart: function(node) {
                return true;
              },
              onDragStop: function(node) {
              },
              onDragEnter: function(node, sourceNode) {
                if(node.data.isFolder) {
                    return ["over"];
                } else {
                    return ["before", "after"];
                }
              },
              onDragLeave: function(node, sourceNode) {
              },
              onDragOver: function(node, sourceNode, hitMode) {
                if(node.isDescendantOf(sourceNode)) return false;
              },
              onDrop: function(node, sourceNode, hitMode, ui, draggable) {
                sourceNode.move(node, hitMode);
                $.ajax({
                    type: 'POST',
                    url: FILE_CONNECTOR,
                    dataType: 'json',
                    data: {
                        mode: 'move',
                        path: sourceNode.data.key,
                        directory: getFolder(node).data.key,
                        _authenticator: getAuthenicator()
                    },
                    async: false,
                    success: function(result){
                        if(result['code'] == 0){
                            var path = sourceNode.data.key;
                            var newPath = result['newPath'];

                            sourceNode.data.key = newPath;
                            sourceNode.render();
                            updateOpenTab(path, newPath);
                        } else {
                            showPrompt({
                                title: localizedMessages.error,
                                description: result['error']
                            });
                        }
                    }
                });
              }
            },
            onCreate: function(node, span){
                bindMenus(span);
            },
            onClick: function(node, event) {
                // Close menu on click
                if( $(".contextMenu:visible").length > 0 ){
                  $(".contextMenu").hide();
                }
            },
            onActivate: function(node) {
                var path = node.data.key;
                if(node.data.isFolder) {
                    currentFolder = path;
                } else {
                    openFile(path);
                }
            }
        });

    });
});
