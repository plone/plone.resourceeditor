// Editor abstraction

var SourceEditor = function(element, mode, data, readonly, onchange, gutter, theme) {
    this.useAce = ! $.browser.msie;

    this.element = '#' + element;
    this.ace = null;

    theme = theme || "ace/theme/textmate";

    if(this.useAce) {
        this.ace = ace.edit(element);

        this.ace.setTheme(theme);
        this.ace.getSession().setTabSize(4);
        this.ace.getSession().setUseSoftTabs(true);
        this.ace.getSession().setUseWrapMode(false);
        this.ace.getSession().setMode(mode);
        this.ace.renderer.setShowGutter(gutter || false);
        this.ace.setShowPrintMargin(false);
        this.ace.setReadOnly(readonly);

        this.ace.getSession().setValue(data);
        this.ace.navigateTo(0, 0);

        if(onchange) {
            this.ace.getSession().on('change', onchange);
        }
    } else {
        $(this.element).replaceWith("<textarea id='" + element + "' class='" + $(this.element).attr('class') + "' wrap='off'></textarea>");
        this.setValue(data);
        if(readonly) {
            $(this.element).attr('readonly', 'true');
        }
        if(onchange) {
            $(this.element).keyup(onchange);
        }
    }

};

SourceEditor.prototype.focus = function() {
        this.useAce? this.ace.focus() : $(this.element).focus();
    };

SourceEditor.prototype.resize = function() {
        this.useAce? this.ace.resize() : $(this.element).resize();
    };

SourceEditor.prototype.getValue = function() {
        return this.useAce? this.ace.getSession().getValue() : $(this.element).text();
    };

SourceEditor.prototype.setValue = function(data) {
        this.useAce? this.ace.getSession().setValue(data) : $(this.element).val(data);
    };

SourceEditor.prototype.setMode = function(mode) {
        this.useAce? this.ace.getSession().setMode(mode) : null;
    };

// Source manager

var SourceManager = function() {
    this.dirty = {};
    this.source = {};
    this.currentPath = null;
};

SourceManager.prototype.isDirty = function(path) {
        if(path == undefined) path = this.currentPath;
        return this.dirty[path] || false;
    };

SourceManager.prototype.markDirty = function(path) {
        if(path == undefined) path = this.currentPath;
        this.dirty[path] = true;
    };

SourceManager.prototype.markClean = function(path) {
        if(path == undefined) path = this.currentPath;
        this.dirty[path] = false;
    };

SourceManager.prototype.hasSource = function(path) {
        return this.source[path] != undefined;
    };

SourceManager.prototype.setSource = function(path, source) {
        if(source == undefined) {
            source = path;
            path = this.currentPath;
        }
        this.source[path] = source;
    };

SourceManager.prototype.getSource = function(path) {
        if(path == undefined) path = this.currentPath;
        return this.source[path];
    };
