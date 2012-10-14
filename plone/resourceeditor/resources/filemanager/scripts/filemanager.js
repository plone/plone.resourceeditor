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

// Singleton giving access to operations in the file manager
var FileManager = {
    enabled: false
};

jQuery(function($) {

    $().ready(function(){

        /*
         * Variables
         */

        // Elements we are controlling
        var fileManagerElement = $("#filemanager");

        if(fileManagerElement.length > 0) {
            var fileTree = $("#filetree");
            var prompt = $("#pb_prompt");

            FileManager.getEditorHeight = function() {
                return Math.max(250, $(window).height() - $("#buttons").height() - fileManagerElement.offset().top - (30 + 100));
            };

            // Settings
            var editorHeight = FileManager.getEditorHeight();

            FileManager.editors = {};
            var nextEditorId = 0;

            FileManager.extensionModes = {
                css: "ace/mode/css",
                js: "ace/mode/javascript",
                htm: "ace/mode/html",
                html: "ace/mode/html",
                xml: "ace/mode/xml"
            };
            var defaultMode = "ace/mode/text";

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
            FileManager.isValidFileName = function(name) {
                if(name === '')
                    return false;

                return ! /[^\w\.\s\-]/gi.test(name);
            };


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
            FileManager.showPrompt = function(options){
                if(options.description === undefined)  options.description = '';
                if(options.buttons === undefined)      options.buttons = ['OK'];
                if(options.callback === undefined)     options.callback = function(){};
                if(options.showInput === undefined)    options.showInput = false;
                if(options.inputValue === undefined)   options.inputValue = '';
                if(options.onBeforeLoad === undefined) options.onBeforeLoad = function(){};

                // Clear old values
                $('.documentFirstHeading,.documentDescription,.formControls', prompt).html('');
                $('.input', prompt).empty();
                if(options.showInput){
                    var newInput = $('<input type="text" name="input" />');
                    newInput.val(options.inputValue);
                    newInput.keyup(function(event) {
                        if(event.keyCode == 13) {

                            event.stopPropagation();
                            event.preventDefault();

                            $('input[type="submit"]', prompt).click();

                            return false;
                        }

                    });

                    $('.input', prompt).append(newInput);
                }

                // Fill new values
                $('.documentFirstHeading', prompt).html(options.title);
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
            };

            // File tree

            /**
             * Get a node in the tree by path
             */
            FileManager.getNodeByPath = function(path) {
                return fileTree.dynatree("getTree").getNodeByKey(path);
            };

            /**
             * Get the currently selected folder in the file tree
             */
            FileManager.getCurrentFolder = function() {
                return FileManager.getNodeByPath(currentFolder) || FileManager.getNodeByPath('/');
            };

            /**
             * Get the folder of the given node
             */
            FileManager.getFolder = function(node) {
                if(!node.data.isFolder){
                    node = node.parent;
                }
                return node;
            };

            /**
             * Get the folder tree
             */
             FileManager.getFolderTree = function(node) {
                return fileTree.dynatree("getTree");
             };

            /**
             * Activate the given node
             */
            FileManager.activateNode = function(path){
                fileTree.dynatree("getTree").activateKey(path);
            };

            /**
             * Generate a key from a parent folder name and a file/folder name.
             */
            FileManager.joinKeyPath = function(parent, name) {
                if(parent === "/") parent = "";
                var path = [parent || "", name || ""].join('/');
                if(path[0] != '/') path = '/' + path;
                return path;
            };

            // Editor


            /**
             * Set the height and width of the editor and file tree
             */
            FileManager.resizeEditor = function(){
                editorHeight = FileManager.getEditorHeight();
                $('#splitter, #fileeditor, .vsplitbar').height(editorHeight);
                fileTree.height(editorHeight-25);
                $('#fileeditor #editors li pre').height(editorHeight-32);
                $("#fileeditor").width($("#splitter").width() - ($("#filetree").width() + $("#splitter .vsplitbar").width() + 2));
            };

            /**
             * Enable or disable the Save button depending on whether the current
             * file is dirty or not
             */
            FileManager.setSaveState = function() {
                var li = $("#fileselector li.selected");
                if(li.hasClass('dirty')){
                    $("#save")[0].disabled = false;
                }else{
                    $("#save")[0].disabled = true;
                }
            };

            FileManager.getCurrentFilePath = function() {
                return $("#fileselector li.selected").attr('rel');
            };

            /**
             * Close the tab for the given path
             */
            FileManager.removeTab = function(path) {
                var tabElement = $("#fileselector li[rel='" + path + "']");
                fileManagerElement.trigger('resourceeditor.closed', path);
                if(tabElement.hasClass('selected') && tabElement.siblings("li").length > 0){
                    var other = tabElement.prev("li");
                    if(other.length === 0) {
                        other = tabElement.siblings("li").eq(0);
                    }
                    other.addClass('selected');
                    $("#editors li[rel='" + other.attr('rel') + "']").addClass('selected');
                    fileManagerElement.trigger('resourceeditor.selected', other.attr('rel'));
                }
                $("#editors li[rel='" + path + "']").remove();
                tabElement.remove();
                FileManager.setSaveState();
            };

            /**
             * Update references for any open tabs when path is moved/renamed to
             * newPath
             */
            FileManager.updateOpenTab = function(path, newPath) {
                $("#fileselector li[rel='" + path + "'] label").text(newPath);
                $("#fileselector li[rel='" + path + "']").attr('rel', newPath);
                $("#editors li[rel='" + path + "']").attr('rel', newPath);

                // Update the editors list
                if(path in FileManager.editors) {
                    FileManager.editors[newPath] = FileManager.editors[path];
                    delete FileManager.editors[path];
                }
            };

            /**
             * Add a tree to select folders to the given container node. Returns
             * a Dynatree instance. Default the selection to the given path.
             */
            FileManager.setupFolderTree = function(parent, path) {
                var promptFileTree = $("<div id='prompt-filetree'></div>");

                $(parent).append("<label class='fileTreeLabel'>" + localizedMessages.location + "</label>");
                $(parent).append(promptFileTree);

                promptFileTree.dynatree({
                    activeVisible: true,
                    initAjax: {
                      url: BASE_URL + '/@@plone.resourceeditor.filetree',
                      data: {
                        'foldersOnly': true
                      }
                    },
                    onPostInit: function(reloading, error) {
                        if(!error && path) {
                            this.activateKey(path);
                        }
                    }
                });

                return promptFileTree.dynatree("getTree");
            };

            // File operations

            /**
             * Open the file with the given path
             */
            FileManager.openFile = function(path, async){
                var relselector = 'li[rel="' + path + '"]';
                if(async === undefined) async = true;

                // Unselect current tab
                $("#fileselector li.selected, #editors li.selected").removeClass('selected');

                // Do we have this file already? If not ...
                if($('#fileselector ' + relselector).size() === 0) {

                    // Create elements for the tab and close button
                    var tab = $('<li class="selected" rel="' + path + '"><label>' + path + '</label></li>');
                    var close = $('<a href="#close" class="closebtn"> x </a>');

                    // Switch to the relevant tab when clicked
                    tab.click(function(){
                        $("#fileselector li.selected,#editors li.selected").removeClass('selected');
                        $(this).addClass('selected');
                        $("#editors li[rel='" + $(this).attr('rel') + "']").addClass('selected');
                        FileManager.setSaveState();
                        fileManagerElement.trigger('resourceeditor.selected', path);

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
                            FileManager.showPrompt({
                                title: localizedMessages.prompt_unsavedchanges,
                                description: localizedMessages.prompt_unsavedchanges_desc,
                                buttons: [localizedMessages.yes, localizedMessages.no, localizedMessages.cancel],
                                callback: function(button){
                                    if(button == localizedMessages.yes) {
                                        $("#save").trigger('click');
                                        FileManager.removeTab(path);
                                    } else if(button == localizedMessages.no) {
                                        FileManager.removeTab(path);
                                    }
                                }
                            });
                        } else {
                            FileManager.removeTab(path);
                        }

                        return false;
                    });

                    // Add the tab and close elements to the page
                    tab.append(close);
                    $("#fileselector").append(tab);

                    // Load the file from the server
                    $.ajax({
                        url: BASE_URL + '/@@plone.resourceeditor.getfile',
                        data: {path: path},
                        dataType: 'json',
                        async: async,
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
                                if (extension in FileManager.extensionModes) {
                                    mode = FileManager.extensionModes[extension];
                                }

                                function markDirty() {
                                    $("#fileselector li[rel='" + path + "']").addClass('dirty');
                                    FileManager.setSaveState();
                                }

                                var editor = new SourceEditor(editorId, mode, data.contents, false, markDirty, true);

                                // Set up key bindings for the editor
                                if(editor.ace !== null) {
                                    editor.ace.commands.addCommand({
                                        name: 'saveEditor',
                                        bindKey: {
                                            mac: 'Command-S',
                                            win: 'Ctrl-S',
                                            sender: 'editor'
                                        },
                                        exec: function(env, args, request) {
                                            var path = FileManager.getCurrentFilePath();
                                            FileManager.saveFile(path);
                                        }
                                    });
                                }

                                FileManager.editors[path] = editor;

                                fileManagerElement.trigger('resourceeditor.loaded', path);
                            } else{
                                editorListItem.append(data.info);
                                $("#editors").append(editorListItem);
                            }
                        }
                    });
                }

                // Activate the given tab and editor
                $("#fileselector " + relselector + ", #editors " + relselector).addClass('selected');
                fileManagerElement.trigger('resourceeditor.selected', path);
            };

            /**
             * Rename an item, prompting for a filename
             */
            FileManager.renameItem = function(node){
                var finalName = '';
                var path = node.data.key;

                FileManager.showPrompt({
                    title: localizedMessages.rename,
                    description: localizedMessages.new_filename,
                    buttons: [localizedMessages.rename, localizedMessages.cancel],
                    inputValue: node.data.title,
                    showInput: true,
                    callback: function(button, rname){
                        if(button != localizedMessages.rename)
                            return;

                        var deferred = null;

                        if(rname === '') {
                            deferred = function() {
                                FileManager.showPrompt({
                                    title: localizedMessages.error,
                                    description: localizedMessages.no_filename
                                });
                            };
                        } else if(!FileManager.isValidFileName(rname)) {
                            deferred = function() {
                                FileManager.showPrompt({
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
                                    if(result['code'] === 0){
                                        // Update the file tree
                                        var newParent = result['newParent'];
                                        var newName = result['newName'];

                                        var newPath = newParent + '/' + newName;

                                        // Trigger event before the node change so that event handlers
                                        // can access the old node
                                        fileManagerElement.trigger('resourceeditor.renamed', [path, newPath]);

                                        recursivelyChangeKeys(path, newPath, node);

                                        node.data.title = newName;
                                        node.render();

                                        FileManager.updateOpenTab(path, newPath);
                                    } else {
                                        deferred = function() {
                                            FileManager.showPrompt({
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
            };

            /**
             * Delete an item, prompting for confirmation
             */
            FileManager.deleteItem = function(node){
                var isDeleted = false;
                var path = node.data.key;

                FileManager.showPrompt({
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
                                if(result['code'] === 0){
                                    FileManager.removeTab(path);

                                    // trigger before we remove the node so event handlers can
                                    // inspect it
                                    fileManagerElement.trigger('resourceeditor.deleted', path);

                                    node.remove();
                                    isDeleted = true;
                                } else {
                                    isDeleted = false;
                                    deferred = function() {
                                        FileManager.showPrompt({
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
            };

            /**
             * Add a new blank file in the currently selected folder, prompting for file name.
             */
            FileManager.addNewFile = function(node){
                var filename = '';
                var showTree = false;
                var tree = null;

                if(node === null) {
                    showTree = true;
                    node = FileManager.getCurrentFolder();
                }

                var path = node.data.key;

                FileManager.showPrompt({
                    title: localizedMessages.create_file,
                    description: localizedMessages.prompt_filename,
                    buttons: [localizedMessages.create_file, localizedMessages.cancel],
                    inputValue: filename,
                    showInput: true,
                    onBeforeLoad: function() {
                        if(showTree) {
                            tree = FileManager.setupFolderTree($(".input", prompt), path);
                        }
                    },
                    callback: function(button, fname){
                        if(button != localizedMessages.create_file)
                            return;

                        if(showTree) {
                            // get the node in the tree in the overlay
                            var selectedNode = tree.getActiveNode();
                            if(selectedNode !== null && FileManager.getNodeByPath(path) !== null) {
                                // get the node in the main tree
                                path = selectedNode.data.key;
                                node = FileManager.getNodeByPath(path);
                            }
                        }

                        var deferred = null;
                        if(fname === '') {
                            deferred = function() {
                                FileManager.showPrompt({
                                    title: localizedMessages.error,
                                    description: localizedMessages.no_filename
                                });
                            };
                        } else if(!FileManager.isValidFileName(fname)) {
                            deferred = function() {
                                FileManager.showPrompt({
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
                                    if(result['code'] === 0) {
                                        var key = FileManager.joinKeyPath(result['parent'], result['name']);
                                        node.addChild({
                                            title: result['name'],
                                            key: key
                                        });
                                        FileManager.openFile(key);
                                        FileManager.activateNode(key);
                                    } else {
                                        deferred = function() {
                                            FileManager.showPrompt({
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
            };

            /**
             * Add a new folder, under the currently selected folder prompting for folder name
             */
            FileManager.addNewFolder = function(node){
                var foldername = '';
                var showTree = false;
                var tree = null;

                if(node === null) {
                    showTree = true;
                    node = FileManager.getCurrentFolder();
                }

                var path = node.data.key;

                FileManager.showPrompt({
                    title: localizedMessages.create_folder,
                    description: localizedMessages.prompt_foldername,
                    buttons: [localizedMessages.create_folder, localizedMessages.cancel],
                    inputValue: foldername,
                    showInput: true,
                    onBeforeLoad: function() {
                        if(showTree) {
                            tree = FileManager.setupFolderTree($(".input", prompt), path);
                        }
                    },
                    callback: function(button, fname){
                        if(button != localizedMessages.create_folder)
                            return;

                        var deferred = null;

                        if(showTree) {
                            // get the node in the tree in the overlay
                            var selectedNode = tree.getActiveNode();
                            if(selectedNode !== null && FileManager.getNodeByPath(path) !== null) {
                                // get the node in the main tree
                                path = selectedNode.data.key;
                                node = FileManager.getNodeByPath(path);
                            }
                        }

                        if(fname === '') {
                            deferred = function() {
                                FileManager.showPrompt({
                                    title: localizedMessages.error,
                                    description: localizedMessages.no_foldername
                                });
                            };
                        } else if(!FileManager.isValidFileName(fname)) {
                            deferred = function() {
                                FileManager.showPrompt({
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
                                    if(result['code'] === 0){
                                        node.addChild({
                                            title: result['name'],
                                            key: FileManager.joinKeyPath(result['parent'], result['name']),
                                            isFolder: true
                                        });
                                    } else {
                                        deferred = function() {
                                            FileManager.showPrompt({
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
            };

            /**
             * Upload a new file to the current folder
             */
            FileManager.uploadFile = function(node){
                var form = null;
                var input = null;
                var showTree = false;
                var tree = null;

                if(node === null) {
                    showTree = true;
                    node = FileManager.getCurrentFolder();
                }

                var path = node.data.key;

                FileManager.showPrompt({
                    title: localizedMessages.upload,
                    description: localizedMessages.prompt_fileupload,
                    buttons: [localizedMessages.upload, localizedMessages.cancel],
                    onBeforeLoad: function(){
                        if($('#fileselector li.selected').length === 0) {
                            $('input[value="' + localizedMessages.upload_and_replace_current + '"]', prompt).remove();
                        }
                        input = $('<input id="newfile" name="newfile" type="file" />');
                        form = $('<form method="post" action="' + FILE_CONNECTOR + '?mode=add"></form>');
                        form.append(input);
                        $('.input', prompt).append(form);

                        if(showTree) {
                            tree = FileManager.setupFolderTree($(".input", prompt), path);
                        }

                        form.ajaxForm({
                            target: '#uploadresponse',
                            beforeSubmit: function(arr, form, options) {
                                // Update path in case it has changed
                                options.data.currentpath = path;
                            },
                            data: {
                                currentpath: path,
                                _authenticator: getAuthenicator()
                            },
                            success: function(result){
                                prompt.overlay().close();
                                var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());

                                if(data['code'] === 0) {
                                    var key = FileManager.joinKeyPath(data['parent'], data['name']);
                                    node.addChild({
                                        title: data['name'],
                                        key: key
                                    });
                                    FileManager.openFile(key);
                                    FileManager.activateNode(key);
                                } else {
                                    FileManager.showPrompt({
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

                        if(showTree) {
                            // get the node in the tree in the overlay
                            var selectedNode = tree.getActiveNode();
                            if(selectedNode !== null && FileManager.getNodeByPath(path) !== null) {
                                // get the node in the main tree
                                path = selectedNode.data.key;
                                node = FileManager.getNodeByPath(path);
                            }
                        }

                        form.trigger('submit');
                        return false;
                    }
                });
            };

            function recursivelyChangeKeys(path, newPath, node) {
                node.data.key = newPath + node.data.key.slice(path.length);
                var children = node.getChildren();
                if(children !== null) {
                    for(var i = 0; i < children.length; ++i) {
                        recursivelyChangeKeys(path, newPath, children[i]);
                    }
                }
            }

            /**
             * Save the current file
             */
            FileManager.saveFile = function(path){
                var editor = FileManager.editors[path];
                $.ajax({
                    url: BASE_URL + '/@@plone.resourceeditor.savefile',
                    data: {
                        path: path,
                        value: editor.getValue()
                    },
                    type: 'POST',
                    success: function() {
                        $("#fileselector li[rel='" + path + "']").removeClass('dirty');
                        FileManager.setSaveState();
                        fileManagerElement.trigger('resourceeditor.saved', path);
                    }
                });
            };

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
            FileManager.resizeEditor();
            $(window).resize(FileManager.resizeEditor);

            // Set up overlay support
            prompt.overlay({
                mask: {
                    color: '#dddddd',
                    loadSpeed: 200,
                    opacity: 0.9
                },
                // top : 0,
                fixed : false,
                closeOnClick: false,
                onLoad: function(event) {
                    $(".input input:first-child", prompt).focus();
                    return true;
                }
            });

            // Provides support for adjustible columns.
            $('#splitter').splitter({
                sizeLeft: 200
            });

            // Bind toolbar buttons

            $('#addnew').click(function(){
                FileManager.addNewFile(null);
                return false;
            });

            $('#newfolder').click(function() {
                FileManager.addNewFolder(null);
                return false;
            });

            $("#upload").click(function(){
                FileManager.uploadFile(null);
                return false;
            });

            $("#save").click(function(){
                var path = FileManager.getCurrentFilePath();
                FileManager.saveFile(path);
                return false;
            });

            // Configure the file tree

            $("#filetree").dynatree({
                initAjax: {
                  url: BASE_URL + '/@@plone.resourceeditor.filetree'
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
                            directory: FileManager.getFolder(node).data.key,
                            _authenticator: getAuthenicator()
                        },
                        async: false,
                        success: function(result){
                            if(result['code'] === 0) {
                                var path = sourceNode.data.key;
                                var newPath = result['newPath'];

                                // Trigger event before the node change so that event handlers
                                // can access the old node
                                fileManagerElement.trigger('resourceeditor.renamed', [path, newPath]);

                                recursivelyChangeKeys(path, newPath, sourceNode);
                                sourceNode.render();

                                FileManager.updateOpenTab(path, newPath);
                            } else {
                                FileManager.showPrompt({
                                    title: localizedMessages.error,
                                    description: result['error']
                                });
                            }
                        }
                    });
                  }
                },
                onCreate: function(node, span){
                    $(span).data('node', node);
                    if(node.data.key == '/') {
                        $(span).contextMenu({menu: "rootItemOptions"}, function(action, el, pos) {
                            var node = $(el).data('node');
                            switch(action) {
                                case "newfolder":
                                    FileManager.addNewFolder(FileManager.getFolder(node));
                                    break;
                                case "addnew":
                                    FileManager.addNewFile(FileManager.getFolder(node));
                                    break;
                                case "upload":
                                    FileManager.uploadFile(FileManager.getFolder(node));
                                    break;
                                default:
                                    break;
                            }
                        });
                    } else {
                        $(span).contextMenu({menu: "itemOptions"}, function(action, el, pos) {
                            var node = $(el).data('node');
                            switch(action) {
                                case "rename":
                                    FileManager.renameItem(node);
                                    break;
                                case "delete":
                                    FileManager.deleteItem(node);
                                    break;
                                case "newfolder":
                                    FileManager.addNewFolder(FileManager.getFolder(node));
                                    break;
                                case "addnew":
                                    FileManager.addNewFile(FileManager.getFolder(node));
                                    break;
                                case "upload":
                                    FileManager.uploadFile(FileManager.getFolder(node));
                                    break;
                                default:
                                    break;
                            }
                        });
                    }
                },
                onClick: function(node, event) {
                    // Close menu on click
                    if( $(".contextMenu:visible").length > 0 ){
                      $(".contextMenu").hide();
                    }

                    // Open file
                    var path = node.data.key;
                    currentFolder = FileManager.getFolder(node).data.key;
                    if(!node.data.isFolder) {
                        FileManager.openFile(path);
                    }
                }
            });

            FileManager.enabled = true;

        }

    });
});
