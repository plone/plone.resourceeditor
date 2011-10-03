Introduction
============

This package contains resources for integrating ACE (http://ace.ajax.org/) into
Plone, with a file manager that can edit plone.resource resource directories
in the ZODB.

ACE can be found under ``++resource++plone.resourceeditor/ace/*``.

The file manager can be included in a view with::

    <tal:block replace="structure view/resourceDirectory/@@plone.resourceeditor.filemanager" />

This assumes usage on a standard main_template page, and that jQuery is in
place.