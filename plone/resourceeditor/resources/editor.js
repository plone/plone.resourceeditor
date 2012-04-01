// Editor abstraction

var SourceEditor = function(element, mode, data, readonly, onchange) {
    this.useAce = ! $.browser.msie;

    this.element = '#' + element;
    this.ace = null;

    if(this.useAce) {
        this.ace = ace.edit(element);

        this.ace.setTheme("ace/theme/textmate");
        this.ace.getSession().setTabSize(4);
        this.ace.getSession().setUseSoftTabs(true);
        this.ace.getSession().setUseWrapMode(false);
        this.ace.getSession().setMode(mode);
        this.ace.renderer.setShowGutter(false);
        this.ace.setShowPrintMargin(false);
        this.ace.setReadOnly(readonly);

        this.ace.getSession().setValue(data);
        this.ace.navigateTo(0, 0);

        if(onchange) {
            this.ace.on('change', onchange);
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
