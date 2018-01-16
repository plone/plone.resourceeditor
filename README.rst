Introduction
============

This package contains resources for integrating ACE (http://ace.ajax.org/) into
Plone, with a file manager that can edit ``plone.resource`` resource directories
in the ZODB.

ACE can be found under ``++resource++plone.resourceeditor/ace/*``.

The file manager can be included in a view with the following in the header::

    <metal:block use-macro="resourceDirectory/@@plone.resourceeditor.filemanager/macros/resources" />

and the following in the body::

    <metal:block use-macro="resourceDirectory/@@plone.resourceeditor.filemanager/macros/filemanager">

In both of these cases, ``resourceDirectory`` should be an in-ZODB
``plone.resource`` resource directory instance.

The macros assume that jQuery is already loaded.
