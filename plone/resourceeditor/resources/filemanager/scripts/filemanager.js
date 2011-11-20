/**
 *	Filemanager JS core
 *
 *	filemanager.js
 *
 *	@license	MIT License
 *	@author		Jason Huck - Core Five Labs
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *  @author     Martin Aspeli
 *  @author     Nathan van Gheem
 *	@copyright	Authors
 */

(function($) {
$(function(){

var _fileTree = $('#filetree');
var _editorHeight = $(window).height() - $('#buttons').height() - 30;
var _prompt = $('#pb_prompt');
_prompt.overlay({
	mask: {
		color: '#DDDDDD',
		loadSpeed: 200,
		opacity: 0.9
	},
	// top : 0,
    fixed : false,
    closeOnClick: false
});

var HTMLMode = require("ace/mode/html").Mode;
var CSSMode  = require("ace/mode/css").Mode;
var XMLMode  = require("ace/mode/xml").Mode;
var JSMode   = require("ace/mode/javascript").Mode;
var TextMode = require("ace/mode/text").Mode;

var _extensionModes = {
    css: new CSSMode(),
    js: new JSMode(),
    htm: new HTMLMode(),
    html: new HTMLMode(),
    xml: new XMLMode()
};
var _defaultMode = new TextMode();
var _editors = {};

var getTree = function(){
    return _fileTree.dynatree("getTree");
}

var getCurrentFolder = function(){
    var folder = _fileTree.dynatree("getActiveNode");
    if(!folder){
        folder = _fileTree.dynatree("getRoot");
    }else if(!folder.data.isFolder){
        folder = node.parent;
    }
    return folder;
}

var getCurrentPath = function(){
    return _fileTree.dynatree('getActiveNode');
}

var getFolder = function(node){
    if(!node.data.isFolder){
        node = node.parent;
    }
    return node;
}

/* Show modal prompt 

options = {
	title: required title shown on prompt,
	description: description of modal,
	callback: called after button is clicked.
		Return false to prevent closing modal.
		Return a function to run after the modal has closed.
	showInput: boolean to show input
	inputValue: value input button should start with
	onBeforeLoad: method to be called before loading the modal prompt
}

*/
var showPrompt = function(options){
	if(options.description === undefined){ options.description = '';}
	if(options.buttons === undefined){ options.buttons = ['OK'];}
	if(options.callback === undefined){ options.callback = function(){};}
	if(options.showInput === undefined){ options.showInput = false;}
	if(options.inputValue === undefined){ options.inputValue = '';}
	if(options.onBeforeLoad === undefined){ options.onBeforeLoad = function(){};}

	// Clear old values
	$('h1.documentFirstHeading,.documentDescription,.formControls', _prompt).html('');
	$('.input', _prompt).empty();
	if(options.showInput){
		$('.input', _prompt).append('<input type="text" name="input" />');
		$('input[type="text"]', _prompt).val(options.inputValue);
	}

	//fill new values
	$('h1.documentFirstHeading', _prompt).html(options.title);
	$('.documentDescription', _prompt).html(options.description);
	for(var i=0; i<options.buttons.length; i++){
		var button = options.buttons[i];
		$('.formControls', _prompt).append(
			'<input class="context" type="submit" name="form.button.' + 
			button + '" value="' + button + '">');
	}
	options.onBeforeLoad();
	$('input[type="submit"]', _prompt).click(function(){
		if(options.showInput){
			result = options.callback($(this).val(), $('input[type="text"]', _prompt).val());
		}else{
			result = options.callback($(this).val());
		}
		if(result === false){
			//cancel closing of form.
			return false;
		}
		_prompt.overlay().close();
		if(typeof(result) == 'function'){
			result();
		}
		return false;
	});
	_prompt.overlay().load();
}

/* Get the csrf authentication value */
var getAuthenicator = function(){
    return $('input[name="_authenticator"]').eq(0).val();
}

/*---------------------------------------------------------
  Setup, Layout, and Status Functions
---------------------------------------------------------*/

// Forces columns to fill the layout vertically.
// Called on initial page load and on resize.
var setDimensions = function(){
	_editorHeight = $(window).height() - $('#buttons').height() - 30;
	$('#splitter, #fileeditor, .vsplitbar').height(_editorHeight);
	_fileTree.height(_editorHeight-25);
	$('#fileeditor ul#aceeditors li pre').height(_editorHeight-32);
}

// nameFormat (), separate filename from extension
var nameFormat = function(input) {
	filename = '';
	if(input.lastIndexOf('.') != -1) {
		filename  = input.substr(0, input.lastIndexOf('.'));
		filename += '.' + input.split('.').pop();
	} else {
		filename = input;
	}
	return filename;
}

var selectFile = function(node){
    if(node.data.isFolder){
        return;
    }
    var relselector = 'li[rel="' + node.data.key + '"]';
    $("#fileselector li.selected,#aceeditors li.selected").removeClass('selected');
    if($('#fileselector ' + relselector).size() == 0){
        var tab = $('<li class="selected" rel="' + node.data.key + '">' + node.data.key + '</li>');
        var close = $('<a href="#close" class="closebtn"> x </a>');
        tab.click(function(){
            $("#fileselector li.selected,#aceeditors li.selected").removeClass('selected');
            $(this).addClass('selected');
            $("#aceeditors li[rel='" + $(this).attr('rel') + "']").addClass('selected');
            setSaveState();
        });
        close.click(function(){
            var tabel = $(this).parent()
            var remove_tab = function(){
                if(tabel.hasClass('selected')){
                    var other = tabel.siblings().eq(0);
                    other.addClass('selected');
                    $("#aceeditors li[rel='" + other.attr('rel') + "']").addClass('selected'); 
                }
                $("#aceeditors li[rel='" + tabel.attr('rel') + "']").remove();
                tabel.remove();
            }
            var dirty = $('#fileselector li.selected').hasClass('dirty');
            if(dirty){
            	showPrompt({
            		title: lg.prompt_unsavedchanges,
            		description: lg.prompt_unsavedchanges_desc,
            		buttons: [lg.yes, lg.no, lg.cancel],
            		callback: function(button){
            			if(button == lg.yes){
            				$("#save").trigger('click');
                            remove_tab();
            			}else if(button == lg.no){
            				remove_tab();
            			}
            		}
            	});
            }
            if(!dirty){
                remove_tab();
            }
            setSaveState();
            return false;
        })
        tab.append(close);
        $("#fileselector").append(tab);
        $.ajax({
            url: BASE_URL + '/@@plone.resourceeditor.getfile',
            data: {path: node.data.key},
            dataType: 'json',
            success: function(data){
                var editorId = 'id' + Math.floor(Math.random()*999999);
                var li = $('<li class="selected" data-editorid="' + editorId + '" rel="' + node.data.key + '"></li>');
                if(data.contents !== undefined){
                    var extension = data.ext;
                    var container = $('<pre id="' + editorId + '" name="' + node.data.key + '">' + data.contents + '</pre>');
                    container.height(_editorHeight - 32);
                    li.append(container);
                    $("#aceeditors").append(li);
                    var editor = ace.edit(editorId);
                    editor.setTheme("ace/theme/textmate");
                    editor.getSession().setTabSize(4);
                    editor.getSession().setUseSoftTabs(true);
                    editor.getSession().setUseWrapMode(false);
                    var mode = _defaultMode;
                    if (extension in _extensionModes) {
                        mode = _extensionModes[extension];
                    }
                    editor.getSession().setMode(mode);
                    editor.setShowPrintMargin(false);

                    editor.getSession().setValue(data.contents);
                    editor.navigateTo(0, 0);
                    _editors[node.data.key] = editor;
                    var markDirty = function(){
                        $("#fileselector li[rel='" + node.data.key + "']").addClass('dirty'); 
                        setSaveState();
                    }
                    editor.getSession().on('change', markDirty);
                }else{
                    li.append(data.info);
                    $("#aceeditors").append(li);
                }
            }
        })
    }
    $("#fileselector " + relselector + ",#aceeditors " + relselector).addClass('selected');
}

// Sets the folder status, upload, and new folder functions 
// to the path specified. Called on initial page load and 
// whenever a new directory is selected.
var setUploader = function(path){
	$('#buttons h1').text(lg.current_folder + path);

    // New
    $('#addnew').unbind().click(function(){
        var filename = '';
        
        var getFileName = function(button, fname){
            if(button != lg.create_file){ return; }
            $('input', _prompt).attr('disabled', 'disabled');
            var deffered = null;
            if(fname != ''){
                filename = fname;
                $.ajax({
                    url: FILE_CONNECTOR,
                    data: {
                        mode: 'addnew',
                        path: getCurrentFolder().data.key,
                        name: filename,
                        _authenticator: getAuthenicator()
                    },
                    async: false,
                    type: 'POST',
                    success: function(result){
                        if(result['Code'] == 0){
                            getCurrentFolder().addChild({ title: result['Name'], key: result['Name'] });
                        } else {
                            deffered = function(){ showPrompt({title:result['Error']}); }
                        }
                    }
                });
            } else {
                deffered = function(){ showPrompt({title: lg.no_filename}); }
            }
            return deffered;
        }
        var btns = [lg.create_file, lg.cancel];
        showPrompt({
            title: lg.create_file,
	        description: lg.prompt_filename,
	        callback: getFileName,
	        buttons: btns,
	        inputValue: filename,
	        showInput: true}); 
    }); 

	$('#newfolder').unbind().click(function(){
		var foldername =  lg.default_foldername;
		
		var getFolderName = function(button, fname){
			if(button != lg.create_folder){return;}
			$('input', _prompt).attr('disabled', 'disabled');
			var deffered = null;
			if(fname != ''){
				foldername = fname;
				$.ajax({
					url: FILE_CONNECTOR,
					data: {
                        mode: 'addfolder',
                        path: getCurrentFolder().data.key,
                        name: foldername,
                        _authenticator: getAuthenicator()
                    }, 
                    async: false,
                    type: 'POST',
                    success: function(result){
				        if(result['Code'] == 0){
                            getCurrentFolder().addChild({ title: result['Name'], key: result['Name'], isFolder: true });
				        } else {
                            deffered = function(){ showPrompt({title:result['Error']});}
				        }				
				    }
            	})
			} else {
				deffered = function(){ showPrompt({title: lg.no_foldername});}
			}
			return deffered
		}
		var btns = [lg.create_folder, lg.cancel];
		showPrompt({
            title: lg.create_folder,
			description: lg.prompt_foldername,
			callback: getFolderName,
			buttons: btns,
			inputValue: foldername,
			showInput: true});	
	});	
}

// Renames the current item and returns the new name.
// Called by clicking the "Rename" button in detail views
// or choosing the "Rename" contextual menu option in 
// list views.
var renameItem = function(node){
	var finalName = '';

	var getNewName = function(button, rname){
		if(button != lg.rename){ return; }
		var deffered = function(){};

		if(rname != ''){
			var givenName = nameFormat(rname);
		
			$.ajax({
				type: 'POST',
				url: FILE_CONNECTOR,
                data: {
                    mode: 'rename',
                    old: node.data.key,
                    new: givenName,
                    _authenticator: getAuthenicator()
                },
				dataType: 'json',
				async: false,
				success: function(result){
					finalName = result['New Name'];
					if(result['Code'] == 0){
						var newPath = result['New Path'];
						var newName = result['New Name'];
                        node = getTree().getNodeByKey(node.data.key);
                        node.data.title = newName;
                        node.data.key = newPath;
                        node.render();
						deffered = function(){ showPrompt({title: lg.successful_rename}); }
					} else {
						deffered = function(){ showPrompt({title: result['Error']}); }
					}
				}
			});	
		}
		return deffered
	}
	var btns = [lg.rename, lg.cancel];
	showPrompt({
        title: lg.rename,
		description: lg.new_filename,
		callback: getNewName,
		buttons: btns,
		inputValue: node.data.title,
		showInput: true});
	
	return finalName;
}

// Prompts for confirmation, then deletes the current item.
// Called by clicking the "Delete" button in detail views
// or choosing the "Delete contextual menu item in list views.
var deleteItem = function(node){
	var isDeleted = false;
	var msg = lg.confirmation_delete;
	
	var doDelete = function(button, value){
		if(button != lg.yes){ return; }
		var deffered = function(){};
		$.ajax({
			type: 'POST',
			url: FILE_CONNECTOR,
			dataType: 'json',
            data: {
                mode: 'delete',
                path: encodeURIComponent(node.data.key),
                _authenticator: getAuthenicator()
            },
			async: false,
			success: function(result){
				if(result['Code'] == 0){
                    node.remove();
					var rootpath = result['Path'].substring(0, result['Path'].length-1); // removing the last slash
					rootpath = rootpath.substr(0, rootpath.lastIndexOf('/') + 1);
					$('#buttons h1').text(lg.current_folder + rootpath);
					isDeleted = true;
				} else {
					isDeleted = false;
					deffered = function(){ showPrompt({title: result['Error']});}
				}
			}
		});
		return deffered;
	}
	var btns = [lg.yes, lg.no];
	showPrompt({title: msg, callback: doDelete, buttons: btns});
	
	return isDeleted;
}

// Binds contextual menus to items in list and grid views.
var setMenus = function(span){
    $(span).contextMenu({menu: "itemOptions"}, function(action, el, pos) {
        // The event was bound to the <span> tag, but the node object
        // is stored in the parent <li> tag
        var node = $.ui.dynatree.getNode(el);
        switch( action ) {
            case "rename":
                var newName = renameItem(node);
                break;
            case "delete":
                deleteItem(node);
                break;
            default:
                break;
        }
    });
}

var setSaveState = function(){
    var li = $("#fileselector li.selected");
    if(li.hasClass('dirty')){
        $("#save")[0].disabled = false;
    }else{
        $("#save")[0].disabled = true;
    }
}

/*---------------------------------------------------------
  Initialization
---------------------------------------------------------*/

// Adjust layout.
setDimensions();
$(window).resize(setDimensions);

// we finalize the FileManager UI initialization 
// with localized text if necessary
$('#upload').append(lg.upload);
$('#addnew').append(lg.add_new);
$('#save').append(lg.savemsg);
$('#saveall').append(lg.saveallmsg);
$('#newfolder').append(lg.new_folder);
$('#itemOptions a[href$="#download"]').append(lg.download);
$('#itemOptions a[href$="#rename"]').append(lg.rename);
$('#itemOptions a[href$="#delete"]').append(lg.del);

// Provides support for adjustible columns.
$('#splitter').splitter({
	sizeLeft: 200
});

// cosmetic tweak for buttons
$('button').wrapInner('<span></span>');

// Provide initial values for upload form, status, etc.
setUploader(FILE_ROOT);

$("#upload").click(function(){
	var form = null;
	var input = null;
	var buttonClicked = null;
	var currentPath = getCurrentFolder().data.key;
	if(currentPath[0] == '/'){
		currentPath = currentPath.substring(1);
	}
	showPrompt({
        title: lg.upload,
		description: lg.prompt_fileupload,
		buttons: [lg.upload, lg.upload_and_replace, lg.upload_and_replace_current, lg.cancel],
		onBeforeLoad: function(){
			if($('#fileselector li.selected').size() == 0){
				$('input[value="' + lg.upload_and_replace_current + '"]', _prompt).remove();
			}
			input = $('<input id="newfile" name="newfile" type="file" />');
			form = $('<form method="post" action="' + FILE_CONNECTOR + '?mode=add"></form>');
			form.append(input);
			$('.input', _prompt).append(form);
			input.change(function(){
                // XXX find a way to validate with new tree...
				if(true){
					$('input[value="' + lg.upload_and_replace + '"]', _prompt).show();
					$('input[value="' + lg.upload + '"]', _prompt).hide();
				}else{
					$('input[value="' + lg.upload_and_replace + '"]', _prompt).hide();
					$('input[value="' + lg.upload + '"]', _prompt).show();
				}
			});
			$('input[value="' + lg.upload_and_replace + '"]', _prompt).hide();
			form.ajaxForm({
				target: '#uploadresponse',
				beforeSubmit: function(arr, form, options) {

				},
				data: {
					currentpath: getCurrentFolder().data.key,
					_authenticator: getAuthenicator()
				},
				success: function(result){
					_prompt.overlay().close();
					var data = jQuery.parseJSON($('#uploadresponse').find('textarea').text());
		
					if(data['Code'] == 0){
                        var node = getCurrentFolder().addChild({ title: result['Name'], key: result['Name'] });
                        node.render();
					} else {
						showPrompt({title: data['Error']});
					}
				},
				forceSync: true
			});
		},
		callback: function(button){
			buttonClicked = button;
			if(button == lg.upload_and_replace){
				form.append('<input type="hidden" name="replacepath" value="' +
					currentPath + input.val() + '" />');
			}else if(button == lg.upload_and_replace_current){
				form.append('<input type="hidden" name="replacepath" value="' +
					$('#fileselector li.selected').attr('rel') + '" />');
			}else if(button == lg.cancel){
				return true;
			}
			form.trigger('submit');
			$('input', _prompt).attr('disabled', 'disabled');
			return false;
		}
	})
});

$("#filetree").dynatree({
    initAjax: {
      url: BASE_URL + '/@@plone.resourceeditor.filetree',
    },
    dnd: {
      onDragStart: function(node) {
        return true;
      },
      onDragStop: function(node) {
      },
      autoExpandMS: 1000,
      preventVoidMoves: true, // Prevent dropping nodes 'before self', etc.
      onDragEnter: function(node, sourceNode) {
        return ["before", "after"];
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
                path: encodeURIComponent(sourceNode.data.key),
                directory: encodeURIComponent(getFolder(node).data.key),
                _authenticator: getAuthenicator()
            },
            async: false,
            success: function(result){
                sourceNode.data.key = result.newpath;
                sourceNode.render();
            }
        });
      },
      onDragLeave: function(node, sourceNode) {
      }
    },
    onCreate: function(node, span){
        setMenus(span);
    },
    onClick: function(node, event) {
        // Close menu on click
        if( $(".contextMenu:visible").length > 0 ){
          $(".contextMenu").hide();
        }
    },
    onActivate: selectFile
});

$("#save").live('click', function(){
    var li = $("#fileselector li.selected");
    var path = li.attr('rel');
    var editor = _editors[path];
    $.ajax({
        url: BASE_URL + '/@@plone.resourceeditor.savefile',
        data: {path: path, value: editor.getSession().getValue()},
        type: 'POST',
        success: function(){
            $("#fileselector li[rel='" + path + "']").removeClass('dirty'); 
            setSaveState();
        }
    });
    return false;
});

// Disable select function if no window.opener
if(window.opener == null) $('#itemOptions a[href$="#select"]').remove();


window.onbeforeunload = function() {
	if($('#fileselector li.dirty').size() > 0){
		return lg.prompt_unsavedchanges;
	}
};

/* key bindings */
var canon = require('pilot/canon');
canon.addCommand({
    name: 'saveEditor',
    bindKey: {
        mac: 'Command-S',
        win: 'Ctrl-S',
        sender: 'editor'
    },
    exec: function(env, args, request) {
        $('#save').trigger('click');
    }
});

canon.addCommand({
    name: 'newFile',
    bindKey: {
        mac: 'Command-N',
        win: 'Ctrl-N',
        sender: 'editor'
    },
    exec: function(env, args, request) {
        $('#addnew').trigger('click');
    }
});

canon.addCommand({
    name: 'newFolder',
    bindKey: {
        mac: 'Command-Shift-N',
        win: 'Ctrl+Shift+N',
        sender: 'editor'
    },
    exec: function(env, args, request) {
        $('#newfolder').trigger('click');
    }
});

canon.addCommand({
    name: 'newFolder',
    bindKey: {
        mac: 'Command-W',
        win: 'Ctrl+W',
        sender: 'editor'
    },
    exec: function(env, args, request) {
        $('#fileselector li.selected a.closebtn').trigger('click');
    }
});

});
})(jQuery);
