# -*- coding: utf-8 -*-
from AccessControl import Unauthorized
from DateTime import DateTime
from OFS.Image import File
from OFS.Image import Image
from plone.resource.directory import FilesystemResourceDirectory
from plone.resource.file import FilesystemFile
from plone.resource.interfaces import IResourceDirectory
from Products.CMFCore.utils import getToolByName
from Products.Five.browser.decode import processInputs
from Products.Five.browser.pagetemplatefile import ViewPageTemplateFile
from time import localtime
from time import strftime
from urlparse import urlparse
from zExceptions import NotFound
from zope.cachedescriptors import property as zproperty
from zope.component import queryMultiAdapter
from zope.component.hooks import getSite
from zope.i18n import translate
from zope.i18nmessageid import MessageFactory
from zope.publisher.browser import BrowserView

import json
import os.path
import posixpath
import re
import urllib


_ = MessageFactory(u'plone')


def authorize(context, request):
    authenticator = queryMultiAdapter((context, request),
                                      name=u'authenticator')
    if authenticator is not None and not authenticator.verify():
        raise Unauthorized


invalidFilenameChars = frozenset('\/:*?"<>|')


def validateFilename(name):
    return len([n for n in name if n in invalidFilenameChars]) == 0


class FileManagerActions(BrowserView):

    imageExtensions = ['png', 'gif', 'jpg', 'jpeg', 'ico']
    previewTemplate = ViewPageTemplateFile('preview.pt')

    @zproperty.Lazy
    def resourceDirectory(self):
        return self.context

    def getObject(self, path):
        path = self.normalizePath(path)
        if not path:
            return self.resourceDirectory
        try:
            return self.resourceDirectory[path]
        except (KeyError, NotFound,):
            raise KeyError(path)

    def getExtension(self, obj=None, path=None):
        if not path:
            path = obj.__name__
        basename, ext = os.path.splitext(path)
        ext = ext[1:].lower()
        return ext

    def getFolder(self, path):
        """Returns a dict of file and folder objects representing the
        contents of the given directory (indicated by a "path" parameter). The
        values are dicts as returned by getInfo().

        A boolean parameter "getsizes" indicates whether image dimensions
        should be returned for each item. Folders should always be returned
        before files.

        Optionally a "type" parameter can be specified to restrict returned
        files (depending on the connector). If a "type" parameter is given for
        the HTML document, the same parameter value is reused and passed
        to getFolder(). This can be used for example to only show image files
        in a file system tree.
        """

        path = path.encode('utf-8')

        folders = []
        files = []

        path = self.normalizePath(path)
        folder = self.getObject(path)

        for name in folder.listDirectory():
            if IResourceDirectory.providedBy(folder[name]):
                folders.append(self.getInfo(
                    folder[name],
                    path='/{0}/{1}/'.format(path, name)
                ))
            else:
                files.append(self.getInfo(
                    folder[name],
                    path='/{0}/{1}'.format(path, name)
                ))
        return folders + files

    def getFile(self, path):
        path = self.normalizePath(path.encode('utf-8'))
        ext = self.getExtension(path=path)
        result = {'ext': ext}
        self.request.response.setHeader('Content-Type', 'application/json')

        if ext in self.imageExtensions:
            obj = self.getObject(path)
            info = self.getInfo(obj)
            info['preview'] = path
            result['info'] = self.previewTemplate(info=info)
            return json.dumps(result)
        else:
            data = self.context.openFile(path)
            try:
                data = data.read()

                result['contents'] = str(data)
                try:
                    return json.dumps(result)
                except UnicodeDecodeError:
                    # The file we're trying to get isn't unicode encodable
                    # so we just return the file information, not the content
                    del result['contents']
                    obj = self.getObject(path)
                    info = self.getInfo(obj)
                    result['info'] = self.previewTemplate(info=info)
                    return json.dumps(result)
            except AttributeError:
                return None

    def normalizePath(self, path):
        if path.startswith('/'):
            path = path[1:]
        if path.endswith('/'):
            path = path[:-1]
        return path

    def normalizeReturnPath(self, path):
        if path.endswith('/'):
            path = path[:-1]
        if not path.startswith('/'):
            path = '/' + path
        return path

    def parentPath(self, path):
        return '/'.join(path.split('/')[:-1])

    def getInfo(self, obj, path='/'):
        """Returns information about a single file. Requests
        with mode "getinfo" will include an additional parameter, "path",
        indicating which file to inspect. A boolean parameter "getsize"
        indicates whether the dimensions of the file (if an image) should be
        returned.
        """
        filename = obj.__name__

        properties = {
            'dateModified': None,
        }

        size = 0

        if isinstance(obj, File):
            properties['dateModified'] = DateTime(obj._p_mtime).strftime('%c')
            size = obj.get_size() / 1024

        if IResourceDirectory.providedBy(obj):
            fileType = 'dir'
            is_folder = True
        else:
            fileType = self.getExtension(obj)
            is_folder = False
        if isinstance(obj, FilesystemFile):
            stats = os.stat(obj.path)
            modified = localtime(stats.st_mtime)
            properties['dateModified'] = strftime('%c', modified)
            size = stats.st_size / 1024

        if size < 1024:
            size_specifier = u'kb'
        else:
            size_specifier = u'mb'
            size = size / 1024
        properties['size'] = '{0}{1}'.format(
            size,
            translate(_(u'filemanager_{0}'.format(size_specifier),
                        default=size_specifier), context=self.request)
        )

        if isinstance(obj, Image):
            properties['height'] = obj.height
            properties['width'] = obj.width

        return {
            'filename': filename,
            'label': filename,
            'fileType': fileType,
            'filesystem': isinstance(obj, FilesystemFile),
            'properties': properties,
            'path': path,
            'folder': is_folder
        }

    def saveFile(self, path, value):
        path = path.lstrip('/').encode('utf-8')
        value = unicode(value.strip(), 'utf-8')
        value = value.replace('\r\n', '\n')

        if path in self.context:
            if IResourceDirectory.providedBy(self.context[path]):
                return json.dumps({'error': 'invalid path'})

        if 'relativeUrls' in self.request.form:
            reg = re.compile('url\(([^)]+)\)')
            urls = reg.findall(value)

            # Trim off the @@plone.resourceeditor bit to just give us the
            # theme url
            limit = self.request.URL.find('@@plone.resourceeditor')
            location = self.request.URL[0:limit]
            base = urlparse(location)
            for url in urls:
                asset = urlparse(url.strip("'").strip('"'))
                if base.netloc != asset.netloc:
                    continue

                base_dir = '.' + posixpath.dirname(base.path)
                target = '.' + asset.path
                out = posixpath.relpath(target, start=base_dir)
                value = value.replace(url.strip('"').strip("'"), out)

        self.request.response.setHeader('Content-Type', 'application/json')
        if isinstance(self.context, FilesystemResourceDirectory):
            # we cannot save in an FS directory, but we return the file content
            # (useful when we compile less from the theming editor)
            return json.dumps({'success': 'tmp', 'value': value})
        else:
            self.context.writeFile(path, value.encode('utf-8'))
            return json.dumps({'success': 'save'})

    def addFolder(self, path, name):
        """Create a new directory on the server within the given path.
        """

        path = path.encode('utf-8')
        name = name.encode('utf-8')

        code = 0
        error = ''

        parentPath = self.normalizePath(path)
        parent = None

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if not validateFilename(name):
                error = translate(_(u'filemanager_invalid_foldername',
                                  default=u'Invalid folder name.'),
                                  context=self.request)
                code = 1
            elif name in parent:
                error = translate(_(u'filemanager_error_folder_exists',
                                  default=u'Folder already exists.'),
                                  context=self.request)
                code = 1
            else:
                try:
                    parent.makeDirectory(name)
                except UnicodeDecodeError:
                    error = translate(
                        _(
                            u'filemanager_invalid_foldername',
                            default=u'Invalid folder name.'
                        ),
                        context=self.request
                    )
                    code = 1

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps({
            'parent': self.normalizeReturnPath(parentPath),
            'name': name,
            'error': error,
            'code': code,
        })

    def addFile(self, path, name):
        """Add a new empty file in the given directory
        """
        path = path.encode('utf-8')
        name = name.encode('utf-8')

        error = ''
        code = 0

        parentPath = self.normalizePath(path)
        newPath = '{0}/{1}'.format(parentPath, name,)

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if not validateFilename(name):
                error = translate(_(u'filemanager_invalid_filename',
                                  default=u'Invalid file name.'),
                                  context=self.request)
                code = 1
            elif name in parent:
                error = translate(_(u'filemanager_error_file_exists',
                                  default=u'File already exists.'),
                                  context=self.request)
                code = 1
            else:
                self.resourceDirectory.writeFile(newPath, '')

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps({
            'parent': self.normalizeReturnPath(parentPath),
            'name': name,
            'error': error,
            'code': code,
            'path': path
        })

    def delete(self, path):
        """Delete the item at the given path.
        """

        path = path.encode('utf-8')

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1]
        code = 0
        error = ''

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            try:
                del parent[name]
            except KeyError:
                error = translate(_(u'filemanager_error_file_not_found',
                                  default=u'File not found.'),
                                  context=self.request)
                code = 1

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps({
            'path': self.normalizeReturnPath(path),
            'error': error,
            'code': code,
        })

    def renameFile(self, path, newName):
        """Rename the item at the given path to the new name
        """

        path = path.encode('utf-8')
        newName = newName.encode('utf-8')

        npath = self.normalizePath(path)
        oldPath = newPath = '/'.join(npath.split('/')[:-1])
        oldName = npath.split('/')[-1]

        code = 0
        error = ''

        try:
            parent = self.getObject(oldPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if newName != oldName:
                if newName in parent:
                    error = translate(
                        _(
                            u'filemanager_error_file_exists',
                            default=u'File already exists.'
                        ),
                        context=self.request)
                    code = 1
                else:
                    parent.rename(oldName, newName)

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps({
            'oldParent': self.normalizeReturnPath(oldPath),
            'oldName': oldName,
            'newParent': self.normalizeReturnPath(newPath),
            'newName': newName,
            'error': error,
            'code': code,
        })

    def move(self, path, directory):
        """Move the item at the given path to a new directory
        """

        path = path.encode('utf-8')
        directory = directory.encode('utf-8')

        npath = self.normalizePath(path)
        newParentPath = self.normalizePath(directory)

        parentPath = self.parentPath(npath)
        filename = npath.split('/')[-1]

        code = 0
        error = ''
        newCanonicalPath = '{0}/{1}'.format(newParentPath, filename)

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
            return json.dumps({
                'code': code,
                'error': error,
                'newPath': self.normalizeReturnPath(newCanonicalPath),
            })

        try:
            target = self.getObject(newParentPath)
        except KeyError:
            error = translate(_(u'filemanager_error_folder_exists',
                              default=u'Destination folder not found.'),
                              context=self.request)
            code = 1
            return json.dumps({
                'code': code,
                'error': error,
                'newPath': self.normalizeReturnPath(newCanonicalPath),
            })

        if filename not in parent:
            error = translate(_(u'filemanager_error_file_not_found',
                              default=u'File not found.'),
                              context=self.request)
            code = 1
        elif filename in target:
            error = translate(_(u'filemanager_error_file_exists',
                              default=u'File already exists.'),
                              context=self.request)
            code = 1
        else:
            obj = parent[filename]
            del parent[filename]
            target[filename] = obj

        return json.dumps({
            'code': code,
            'error': error,
            'newPath': self.normalizeReturnPath(newCanonicalPath),
        })

    def do_action(self, action):
        if action == 'dataTree':

            def getDirectory(folder, relpath=''):
                items = []
                for name in folder.listDirectory():
                    obj = folder[name]
                    path = relpath + '/' + name
                    if IResourceDirectory.providedBy(obj):
                        try:
                            children = getDirectory(obj, path)
                        except NotFound:
                            children = []
                        items.append({
                            'label': name,
                            'folder': True,
                            'path': path,
                            'children': children
                        })
                    else:
                        items.append(self.getInfo(obj, path))
                return items

            return json.dumps(getDirectory(self.context))

        if action == 'getFile':
            path = self.request.get('path', '')
            return self.getFile(path)

        if action == 'saveFile':
            path = self.request.get('path', '')
            data = self.request.get('data', '')
            return self.saveFile(path, data)

        if action == 'addFolder':
            path = self.request.get('path', '')
            name = self.request.get('name', '')
            return self.addFolder(path, name)

        if action == 'addFile':
            path = self.request.get('path', '')
            name = self.request.get('filename', '')
            return self.addFile(path, name)

        if action == 'renameFile':
            path = self.request.get('path', '')
            name = self.request.get('filename', '')
            return self.renameFile(path, name)

        if action == 'delete':
            path = self.request.get('path', '')
            return self.delete(path)

        if action == 'move':
            src_path = self.request.get('source', '')
            des_path = self.request.get('destination', '')
            return self.move(src_path, des_path)

    def download(self, path):
        """Serve the requested file to the user
        """

        path = path.encode('utf-8')

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1]

        parent = self.getObject(parentPath)

        self.request.response.setHeader('Content-Type',
                                        'application/octet-stream')
        self.request.response.setHeader(
            'Content-Disposition',
            'attachment; filename="{0}"'.format(name)
        )

        # TODO: Use streams here if we can
        return parent.readFile(name)

    def __call__(self):
        action = self.request.get('action')
        return self.do_action(action)


class FileManager(BrowserView):
    """Render the file manager and support its AJAX requests.
    """

    previewTemplate = ViewPageTemplateFile('preview.pt')
    staticFiles = '++resource++plone.resourceeditor/filemanager'
    imageExtensions = ['png', 'gif', 'jpg', 'jpeg']
    knownExtensions = ['css', 'html', 'htm', 'txt', 'xml', 'js', 'cfg']
    capabilities = ['download', 'rename', 'delete']

    extensionsWithIcons = frozenset([
        'aac', 'avi', 'bmp', 'chm', 'css', 'dll', 'doc', 'fla',
        'gif', 'htm', 'html', 'ini', 'jar', 'jpeg', 'jpg', 'js',
        'lasso', 'mdb', 'mov', 'mp3', 'mpg', 'pdf', 'php', 'png',
        'ppt', 'py', 'rb', 'real', 'reg', 'rtf', 'sql', 'swf', 'txt',
        'vbs', 'wav', 'wma', 'wmv', 'xls', 'xml', 'xsl', 'zip',
    ])

    protectedActions = (
        'addfolder', 'add', 'addnew',
        'rename', 'delete'
    )

    def pattern_options(self):
        site = getSite()
        viewName = '@@plone.resourceeditor.filemanager-actions'
        return json.dumps({
            'actionUrl': '{0}/++{1}++{2}/{3}'.format(
                site.absolute_url(),
                self.context.__parent__.__parent__.__name__,
                self.context.__name__,
                viewName
            )
        })

    def mode_selector(self, form):
        # AJAX methods called by the file manager
        mode = form['mode']

        if mode in self.protectedActions:
            authorize(self.context, self.request)

        response = {'error:': 'Unknown request', 'code': -1}
        textareaWrap = False

        if mode == u'getfolder':
            response = self.getFolder(
                path=urllib.unquote(form['path']),
                getSizes=form.get('getsizes', 'false') == 'true'
            )
        elif mode == u'getinfo':
            response = self.getInfo(
                path=urllib.unquote(form['path']),
                getSize=form.get('getsize', 'false') == 'true'
            )
        elif mode == u'addfolder':
            response = self.addFolder(
                path=urllib.unquote(form['path']),
                name=urllib.unquote(form['name'])
            )
        elif mode == u'add':
            textareaWrap = True
            response = self.add(
                path=urllib.unquote(form['currentpath']),
                newfile=form['newfile'],
                replacepath=form.get('replacepath', None)
            )
        elif mode == u'addnew':
            response = self.addNew(
                path=urllib.unquote(form['path']),
                name=urllib.unquote(form['name'])
            )
        elif mode == u'rename':
            response = self.rename(
                path=urllib.unquote(form['old']),
                newName=urllib.unquote(form['new'])
            )
        elif mode == u'delete':
            response = self.delete(
                path=urllib.unquote(form['path'])
            )
        elif mode == 'move':
            response = self.move(
                path=urllib.unquote(form['path']),
                directory=urllib.unquote(form['directory'])
            )
        elif mode == u'download':
            return self.download(
                path=urllib.unquote(form['path'])
            )
        if textareaWrap:
            self.request.response.setHeader('Content-Type', 'text/html')
            return '<textarea>{0}</textarea>'.format(json.dumps(response))
        self.request.response.setHeader('Content-Type',
                                        'application/json')
        return json.dumps(response)

    def __call__(self):
        # make sure theme is disable for these requests
        self.request.response.setHeader('X-Theme-Disabled', 'True')
        self.request['HTTP_X_THEME_ENABLED'] = False

        self.setup()
        form = self.request.form

        # AJAX methods called by the file manager
        if 'mode' in form:
            return self.mode_selector(form)

        # Rendering the view
        else:
            return self.index()

    def setup(self):
        processInputs(self.request)

    @zproperty.Lazy
    def portalUrl(self):
        return getToolByName(self.context, 'portal_url')()

    @zproperty.Lazy
    def resourceDirectory(self):
        return self.context

    @zproperty.Lazy
    def resourceType(self):
        return self.resourceDirectory.__parent__.__parent__.__name__

    @zproperty.Lazy
    def baseUrl(self):
        return '{0}/++{1}++{2}'.format(
            self.portalUrl,
            self.resourceType,
            self.resourceDirectory.__name__
        )

    @zproperty.Lazy
    def fileConnector(self):
        return '{0}/@@{1}'.format(self.baseUrl, self.__name__,)

    @zproperty.Lazy
    def filemanagerConfiguration(self):
        return """\
var FILE_ROOT = '/';
var IMAGES_EXT = {0};
var CAPABILITIES = {1};
var FILE_CONNECTOR = '{2}';
var BASE_URL = '{3}';
""".format(
            repr(self.imageExtensions),
            repr(self.capabilities),
            self.fileConnector,
            self.baseUrl,
        )

    def normalizePath(self, path):
        if path.startswith('/'):
            path = path[1:]
        if path.endswith('/'):
            path = path[:-1]
        return path

    def normalizeReturnPath(self, path):
        if path.endswith('/'):
            path = path[:-1]
        if not path.startswith('/'):
            path = '/' + path
        return path

    def parentPath(self, path):
        return '/'.join(path.split('/')[:-1])

    # AJAX responses

    def getFolder(self, path, getSizes=False):
        """Returns a dict of file and folder objects representing the
        contents of the given directory (indicated by a "path" parameter). The
        values are dicts as returned by getInfo().

        A boolean parameter "getsizes" indicates whether image dimensions
        should be returned for each item. Folders should always be returned
        before files.

        Optionally a "type" parameter can be specified to restrict returned
        files (depending on the connector). If a "type" parameter is given for
        the HTML document, the same parameter value is reused and passed
        to getFolder(). This can be used for example to only show image files
        in a file system tree.
        """

        path = path.encode('utf-8')

        folders = []
        files = []

        path = self.normalizePath(path)
        folder = self.getObject(path)

        for name in folder.listDirectory():
            if IResourceDirectory.providedBy(folder[name]):
                folders.append(self.getInfo(
                    path='{0}/{1}/'.format(path, name), getSize=getSizes))
            else:
                files.append(self.getInfo(
                    path='{0}/{1}'.format(path, name), getSize=getSizes))
        return folders + files

    def getInfo(self, path, getSize=False):
        """Returns information about a single file. Requests
        with mode "getinfo" will include an additional parameter, "path",
        indicating which file to inspect. A boolean parameter "getsize"
        indicates whether the dimensions of the file (if an image) should be
        returned.
        """

        path = path.encode('utf-8')

        path = self.normalizePath(path)
        obj = self.getObject(path)

        filename = obj.__name__
        error = ''
        errorCode = 0

        properties = {
            'dateModified': None,
        }

        if isinstance(obj, File):
            properties['dateModified'] = DateTime(obj._p_mtime).strftime('%c')
            size = obj.get_size() / 1024
            if size < 1024:
                size_specifier = u'kb'
            else:
                size_specifier = u'mb'
                size = size / 1024
            properties['size'] = '{0}{1}'.format(
                size,
                translate(_(u'filemanager_{0}'.format(size_specifier),
                            default=size_specifier), context=self.request)
            )

        fileType = 'txt'

        siteUrl = self.portalUrl
        resourceName = self.resourceDirectory.__name__

        preview = '{0}/{1}/images/fileicons/default.png'.format(
            siteUrl,
            self.staticFiles
        )

        if IResourceDirectory.providedBy(obj):
            preview = '{0}/{1}/images/fileicons/_Open.png'.format(
                siteUrl,
                self.staticFiles
            )
            fileType = 'dir'
            path = path + '/'
        else:
            fileType = self.getExtension(path, obj)
            if fileType in self.imageExtensions:
                preview = '{0}/++{1}++{2}/{3}'.format(
                    siteUrl,
                    self.resourceType,
                    resourceName,
                    path
                )
            elif fileType in self.extensionsWithIcons:
                preview = '{0}/{1}/images/fileicons/{2}.png'.format(
                    siteUrl,
                    self.staticFiles,
                    fileType
                )

        if isinstance(obj, Image):
            properties['height'] = obj.height
            properties['width'] = obj.width

        return {
            'path': self.normalizeReturnPath(path),
            'filename': filename,
            'fileType': fileType,
            'preview': preview,
            'properties': properties,
            'error': error,
            'code': errorCode,
        }

    def addFolder(self, path, name):
        """Create a new directory on the server within the given path.
        """

        path = path.encode('utf-8')
        name = name.encode('utf-8')

        code = 0
        error = ''

        parentPath = self.normalizePath(path)
        parent = None

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if not validateFilename(name):
                error = translate(_(u'filemanager_invalid_foldername',
                                  default=u'Invalid folder name.'),
                                  context=self.request)
                code = 1
            elif name in parent:
                error = translate(_(u'filemanager_error_folder_exists',
                                  default=u'Folder already exists.'),
                                  context=self.request)
                code = 1
            else:
                try:
                    parent.makeDirectory(name)
                except UnicodeDecodeError:
                    error = translate(
                        _(
                            u'filemanager_invalid_foldername',
                            default=u'Invalid folder name.'
                        ),
                        context=self.request
                    )
                    code = 1

        return {
            'parent': self.normalizeReturnPath(parentPath),
            'name': name,
            'error': error,
            'code': code,
        }

    def add(self, path, newfile, replacepath=None):
        """Add the uploaded file to the specified path. Unlike
        the other methods, this method must return its JSON response wrapped in
        an HTML <textarea>, so the MIME type of the response is text/html
        instead of text/plain. The upload form in the File Manager passes the
        current path as a POST param along with the uploaded file. The response
        includes the path as well as the name used to store the file. The
        uploaded file's name should be safe to use as a path component in a
        URL, so URL-encoded at a minimum.
        """

        path = path.encode('utf-8')
        if replacepath is not None:
            replacepath = replacepath.encode('utf-8')

        parentPath = self.normalizePath(path)

        error = ''
        code = 0

        name = newfile.filename
        if isinstance(name, unicode):
            name = name.encode('utf-8')

        if replacepath:
            newPath = replacepath
            parentPath = '/'.join(replacepath.split('/')[:-1])
        else:
            newPath = '{0}/{1}'.format(parentPath, name,)

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if name in parent and not replacepath:
                error = translate(_(u'filemanager_error_file_exists',
                                  default=u'File already exists.'),
                                  context=self.request)
                code = 1
            else:
                try:
                    self.resourceDirectory.writeFile(newPath, newfile)
                except ValueError:
                    error = translate(_(u'filemanager_error_file_invalid',
                                      default=u'Could not read file.'),
                                      context=self.request)
                    code = 1

        return {
            'parent': self.normalizeReturnPath(parentPath),
            'path': self.normalizeReturnPath(path),
            'name': name,
            'error': error,
            'code': code,
        }

    def addNew(self, path, name):
        """Add a new empty file in the given directory
        """

        path = path.encode('utf-8')
        name = name.encode('utf-8')

        error = ''
        code = 0

        parentPath = self.normalizePath(path)
        newPath = '{0}/{1}'.format(parentPath, name,)

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if not validateFilename(name):
                error = translate(_(u'filemanager_invalid_filename',
                                  default=u'Invalid file name.'),
                                  context=self.request)
                code = 1
            elif name in parent:
                error = translate(_(u'filemanager_error_file_exists',
                                  default=u'File already exists.'),
                                  context=self.request)
                code = 1
            else:
                self.resourceDirectory.writeFile(newPath, '')

        return {
            'parent': self.normalizeReturnPath(parentPath),
            'name': name,
            'error': error,
            'code': code,
        }

    def rename(self, path, newName):
        """Rename the item at the given path to the new name
        """

        path = path.encode('utf-8')
        newName = newName.encode('utf-8')

        npath = self.normalizePath(path)
        oldPath = newPath = '/'.join(npath.split('/')[:-1])
        oldName = npath.split('/')[-1]

        code = 0
        error = ''

        try:
            parent = self.getObject(oldPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            if newName != oldName:
                if newName in parent:
                    error = translate(
                        _(u'filemanager_error_file_exists',
                          default=u'File already exists.'),
                        context=self.request)
                    code = 1
                else:
                    parent.rename(oldName, newName)

        return {
            'oldParent': self.normalizeReturnPath(oldPath),
            'oldName': oldName,
            'newParent': self.normalizeReturnPath(newPath),
            'newName': newName,
            'error': error,
            'code': code,
        }

    def delete(self, path):
        """Delete the item at the given path.
        """

        path = path.encode('utf-8')

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1]
        code = 0
        error = ''

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
        else:
            try:
                del parent[name]
            except KeyError:
                error = translate(_(u'filemanager_error_file_not_found',
                                  default=u'File not found.'),
                                  context=self.request)
                code = 1

        return {
            'path': self.normalizeReturnPath(path),
            'error': error,
            'code': code,
        }

    def move(self, path, directory):
        """Move the item at the given path to a new directory
        """

        path = path.encode('utf-8')
        directory = directory.encode('utf-8')

        npath = self.normalizePath(path)
        newParentPath = self.normalizePath(directory)

        parentPath = self.parentPath(npath)
        filename = npath.split('/')[-1]

        code = 0
        error = ''
        newCanonicalPath = '{0}/{1}'.format(newParentPath, filename)

        try:
            parent = self.getObject(parentPath)
        except KeyError:
            error = translate(_(u'filemanager_invalid_parent',
                              default=u'Parent folder not found.'),
                              context=self.request)
            code = 1
            return {
                'code': code,
                'error': error,
                'newPath': self.normalizeReturnPath(newCanonicalPath),
            }

        try:
            target = self.getObject(newParentPath)
        except KeyError:
            error = translate(_(u'filemanager_error_folder_exists',
                              default=u'Destination folder not found.'),
                              context=self.request)
            code = 1
            return {
                'code': code,
                'error': error,
                'newPath': self.normalizeReturnPath(newCanonicalPath),
            }

        if filename not in parent:
            error = translate(_(u'filemanager_error_file_not_found',
                              default=u'File not found.'),
                              context=self.request)
            code = 1
        elif filename in target:
            error = translate(_(u'filemanager_error_file_exists',
                              default=u'File already exists.'),
                              context=self.request)
            code = 1
        else:
            obj = parent[filename]
            del parent[filename]
            target[filename] = obj

        return {
            'code': code,
            'error': error,
            'newPath': self.normalizeReturnPath(newCanonicalPath),
        }

    def download(self, path):
        """Serve the requested file to the user
        """

        path = path.encode('utf-8')

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1]

        parent = self.getObject(parentPath)

        self.request.response.setHeader('Content-Type',
                                        'application/octet-stream')
        self.request.response.setHeader(
            'Content-Disposition',
            'attachment; filename="{0}"'.format(name)
        )

        # TODO: Use streams here if we can
        return parent.readFile(name)

    # Helpers
    def getObject(self, path):
        path = self.normalizePath(path)
        if not path:
            return self.resourceDirectory
        try:
            return self.resourceDirectory[path]
        except (KeyError, NotFound,):
            raise KeyError(path)

    def getExtension(self, path, obj):
        basename, ext = os.path.splitext(path)
        ext = ext[1:].lower()

        ct = obj.getContentType()
        if ct:
            # take content type of the file over extension if available
            if '/' in ct:
                _ext = ct.split('/')[1].lower()
            if _ext in self.extensionsWithIcons:
                return _ext
        return ext

    # Methods that are their own views
    def getFile(self, path):
        self.setup()

        path = path.encode('utf-8')

        path = self.normalizePath(path)
        file = self.context.context.unrestrictedTraverse(path)
        ext = self.getExtension(path, file)
        result = {'ext': ext}
        if ext not in self.imageExtensions:
            result['contents'] = str(file.data)
        else:
            info = self.getInfo(path)
            result['info'] = self.previewTemplate(info=info)

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps(result)

    def saveFile(self, path, value):
        processInputs(self.request)

        path = self.request.form.get('path', path)
        value = self.request.form.get('value', value)

        path = path.lstrip('/').encode('utf-8')
        value = value.replace('\r\n', '\n').encode('utf-8')
        self.context.writeFile(path, value)
        return ' '  # Zope no likey empty responses

    def filetree(self):

        foldersOnly = bool(self.request.get('foldersOnly', False))

        def getFolder(root, relpath=''):
            result = []
            for name in root.listDirectory():
                path = '{0}/{1}'.format(relpath, name)
                if IResourceDirectory.providedBy(root[name]):
                    item = {
                        'title': name,
                        'key': path,
                        'isFolder': True
                    }
                    item['children'] = getFolder(root[name], path)
                    result.append(item)
                elif not foldersOnly:
                    item = {'title': name, 'key': path}
                    result.append(item)
            return result
        return json.dumps([{
            'title': '/',
            'key': '/',
            'isFolder': True,
            'expand': True,
            'children': getFolder(self.context)
        }])
