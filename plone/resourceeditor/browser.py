import urllib
import os.path
import json

from zope.component import queryMultiAdapter
from zope.site.hooks import getSite
from zope.publisher.browser import BrowserView
from zope.i18n import translate
from zope.i18nmessageid import MessageFactory

from plone.resource.interfaces import IResourceDirectory

from AccessControl import Unauthorized
from zExceptions import NotFound
from OFS.Image import File, Image
from Products.Five.browser.decode import processInputs
from Products.Five.browser.pagetemplatefile import ViewPageTemplateFile
from Products.CMFCore.utils import getToolByName

_ = MessageFactory(u"plone")


def authorize(context, request):
    authenticator = queryMultiAdapter((context, request),
                                      name=u"authenticator")
    if authenticator is not None and not authenticator.verify():
        raise Unauthorized


class FileManager(BrowserView):
    """Render the file manager and support its AJAX requests.
    """

    previewTemplate = ViewPageTemplateFile('preview.pt')
    staticFiles = "++resource++plone.resourceeditor/filemanager"
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

    def __call__(self):
        self.setup()
        form = self.request.form

        # AJAX methods called by the file manager
        if 'mode' in form:
            mode = form['mode']

            if mode in self.protectedActions:
                authorize(self.context, self.request)

            response = {'Error:': 'Unknown request', 'Code': -1}
            textareaWrap = False

            if mode == u'getfolder':
                response = self.getFolder(
                    path=urllib.unquote(form['path']),
                    getSizes=form.get('getsizes', 'false') == 'true')
            elif mode == u'getinfo':
                response = self.getInfo(
                    path=urllib.unquote(form['path']),
                    getSize=form.get('getsize', 'false') == 'true')
            elif mode == u'addfolder':
                response = self.addFolder(
                    path=urllib.unquote(form['path']),
                    name=urllib.unquote(form['name']))
            elif mode == u'add':
                textareaWrap = True
                response = self.add(
                    path=urllib.unquote(form['currentpath']),
                    newfile=form['newfile'],
                    replacepath=form.get('replacepath', None))
            elif mode == u'addnew':
                response = self.addNew(
                    path=urllib.unquote(form['path']),
                    name=urllib.unquote(form['name']))
            elif mode == u'rename':
                response = self.rename(
                    path=urllib.unquote(form['old']),
                    newName=urllib.unquote(form['new']))
            elif mode == u'delete':
                response = self.delete(
                    path=urllib.unquote(form['path']))
            elif mode == u'download':
                return self.download(
                    path=urllib.unquote(form['path']))
            elif mode == 'move':
                return self.move(
                    path=urllib.unquote(form['path']),
                    directory=urllib.unquote(form['directory']))
            if textareaWrap:
                self.request.response.setHeader('Content-Type', 'text/html')
                return "<textarea>%s</textarea>" % json.dumps(response)
            else:
                self.request.response.setHeader('Content-Type',
                                                'application/json')
                return json.dumps(response)

        # Rendering the view
        else:
            if self.update():
                # Evil hack to deal with the lack of implicit acquisition from
                # resource directories
                self.context = getSite()
                return self.index()
            return ''

    def setup(self):
        processInputs(self.request)

        self.resourceDirectory = self.context
        self.name = self.resourceDirectory.__name__
        self.resourceType = \
            self.resourceDirectory.__parent__.__parent__.__name__
        self.title = self.name.capitalize().replace('-', ' ').replace('.', ' ')

        self.portalUrl = getToolByName(self.context, 'portal_url')()

    def normalizePath(self, path):
        if path.startswith('/'):
            path = path[1:]
        if path.endswith('/'):
            path = path[:-1]
        return path

    def parentPath(self, path):
        return '/'.join(path.split('/')[:-1])

    def update(self):
        baseUrl = "%s/++%s++%s" % (self.portalUrl, self.resourceType,
                                   self.resourceDirectory.__name__)
        fileConnector = "%s/@@%s" % (baseUrl, self.__name__,)

        self.filemanagerConfiguration = """\
var FILE_ROOT = '/';
var IMAGES_EXT = %s;
var CAPABILITIES = %s;
var FILE_CONNECTOR = '%s';
var BASE_URL = '%s';
""" % (repr(self.imageExtensions),
       repr(self.capabilities),
       fileConnector,
       baseUrl,)

        return True

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
        folders = []
        files = []

        path = self.normalizePath(path)
        folder = self.getObject(path)

        for name in folder.listDirectory():
            if IResourceDirectory.providedBy(folder[name]):
                folders.append(self.getInfo(
                    path="%s/%s/" % (path, name), getSize=getSizes))
            else:
                files.append(self.getInfo(
                    path="%s/%s" % (path, name), getSize=getSizes))
        return folders + files

    def getInfo(self, path, getSize=False):
        """ Returns information about a single file. Requests
        with mode "getinfo" will include an additional parameter, "path",
        indicating which file to inspect. A boolean parameter "getsize"
        indicates whether the dimensions of the file (if an image) should be
        returned.
        """

        path = self.normalizePath(path)
        obj = self.getObject(path)

        filename = obj.__name__
        error = ''
        errorCode = 0

        properties = {
            'dateCreated': None,
            'dateModified': None,
        }

        if isinstance(obj, File):
            properties['dateCreated'] = obj.created().strftime('%c')
            properties['dateModified'] = obj.modified().strftime('%c')
            size = obj.get_size() / 1024
            if size < 1024:
                size_specifier = u'kb'
            else:
                size_specifier = u'mb'
                size = size / 1024
            properties['size'] = '%i%s' % (size,
                translate(_(u'filemanager_%s' % size_specifier,
                          default=size_specifier), context=self.request)
                )

        fileType = 'txt'

        siteUrl = self.portalUrl
        resourceName = self.resourceDirectory.__name__

        preview = "%s/%s/images/fileicons/default.png" % (siteUrl,
                                                          self.staticFiles)

        if IResourceDirectory.providedBy(obj):
            preview = "%s/%s/images/fileicons/_Open.png" % (siteUrl,
                                                            self.staticFiles)
            fileType = 'dir'
            path = path + '/'
        else:
            fileType = self.getExtension(path, obj)
            if fileType in self.imageExtensions:
                preview = '%s/++%s++%s/%s' % (siteUrl, self.resourceType,
                                              resourceName, path)
            elif fileType in self.extensionsWithIcons:
                preview = "%s/%s/images/fileicons/%s.png" % (siteUrl,
                                                             self.staticFiles,
                                                             fileType)

        if getSize and isinstance(obj, Image):
            properties['height'] = obj.height
            properties['width'] = obj.width

        return {
            'Path': path,
            'Filename': filename,
            'File Type': fileType,
            'preview': preview,
            'properties': properties,
            'Error': error,
            'Code': errorCode,
        }

    def addFolder(self, path, name):
        """The addfolder method creates a new directory on the server within
        the given path.
        """

        parent = self.getObject(path)
        parent.makeDirectory(name)

        return {
            'Parent': path,
            'Name': name,
            'Error': '',
            'Code': 0,
        }

    def add(self, path, newfile, replacepath=None):
        """The add method adds the uploaded file to the specified path. Unlike
        the other methods, this method must return its JSON response wrapped in
        an HTML <textarea>, so the MIME type of the response is text/html
        instead of text/plain. The upload form in the File Manager passes the
        current path as a POST param along with the uploaded file. The response
        includes the path as well as the name used to store the file. The
        uploaded file's name should be safe to use as a path component in a
        URL, so URL-encoded at a minimum.
        """

        parentPath = self.normalizePath(path)

        error = ''
        code = 0

        name = newfile.filename
        if replacepath:
            newPath = replacepath
            parentPath = '/'.join(replacepath.split('/')[:-1])
        else:
            newPath = u"%s/%s" % (parentPath, name,)

        parent = self.getObject(parentPath)
        if name in parent and not replacepath:
            error = translate(_(u'filemanager_error_file_exists',
                              default=u"File already exists."),
                              context=self.request)
            code = 1
        else:
            try:
                self.resourceDirectory.writeFile(newPath.encode('utf-8'),
                                                 newfile)
            except (ValueError,):
                error = translate(_(u'filemanager_error_file_invalid',
                                  default=u"Could not read file."),
                                  context=self.request)
                code = 1

        return {
            "Path": path,
            "Name": name,
            "Error": error,
            "Code": code,
        }

    def addNew(self, path, name):
        """Add a new empty file in the given directory
        """

        error = ''
        code = 0

        parentPath = self.normalizePath(path)
        newPath = u"%s/%s" % (parentPath, name,)

        parent = self.getObject(parentPath)
        if name in parent:
            error = translate(_(u'filemanager_error_file_exists',
                              default=u"File already exists."),
                              context=self.request)
            code = 1
        else:
            self.resourceDirectory.writeFile(newPath.encode('utf-8'), '')

        return {
            "Parent": path,
            "Name": name,
            "Error": error,
            "Code": code,
        }

    def rename(self, path, newName):
        """The rename method renames the item at the path given in the "old"
        parameter with the name given in the "new" parameter and returns an
        object indicating the results of that action.
        """

        npath = self.normalizePath(path)
        oldPath = newPath = '/'.join(npath.split('/')[:-1])
        oldName = npath.split('/')[-1]

        parent = self.getObject(oldPath)
        parent.rename(oldName, newName)

        return {
            "Old Path": oldPath,
            "Old Name": oldName,
            "New Path": newPath,
            "New Name": newName,
            'Error': '',
            'Code': 0,
        }

    def delete(self, path):
        """The delete method deletes the item at the given path.
        """

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1]

        parent = self.getObject(parentPath)
        del parent[name]

        return {
            'Path': path,
            'Error': '',
            'Code': 0,
        }

    def download(self, path):
        """The download method serves the requested file to the user.
        """

        npath = self.normalizePath(path)
        parentPath = '/'.join(npath.split('/')[:-1])
        name = npath.split('/')[-1].encode('utf-8')

        parent = self.getObject(parentPath)

        self.request.response.setHeader('Content-Type',
                                        'application/octet-stream')
        self.request.response.setHeader('Content-Disposition',
                                        'attachment; filename="%s"' % name)

        # TODO: Use streams here if we can
        return parent.readFile(name)

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
        path = self.normalizePath(path)
        file = self.context.context.unrestrictedTraverse(path.encode('utf-8'))
        ext = self.getExtension(path, file)
        result = {'ext': ext}
        if ext in self.knownExtensions:
            result['contents'] = str(file.data)
        else:
            info = self.getInfo(path)
            result['info'] = self.previewTemplate(info=info)

        self.request.response.setHeader('Content-Type', 'application/json')
        return json.dumps(result)

    def saveFile(self, path, value):
        processInputs(self.request)
        value = value.replace('\r\n', '\n')
        self.context.writeFile(path, value.encode('utf-8'))
        return ' '  # Zope no likey empty responses

    def move(self, path, directory):
        npath = self.normalizePath(path)
        parentPath = self.parentPath(npath)
        filename = npath.split('/')[-1]
        parent = self.getObject(parentPath)
        directory = self.normalizePath(directory)
        todirectory = self.getObject(directory)
        file = self.getObject(npath)
        parent.context._delOb(filename)
        count = 1
        ext = self.getExtension(path, file)
        while filename in parent:
            filename = '%s-%i.%s' % (
                filename.replace('.' + ext, ''),
                count,
                ext
            )
            count += 1
        todirectory.context._setOb(filename, file)

        return json.dumps({'newpath': '/%s/%s' % (directory, filename)})

    def filetree(self):
        def getFolder(root, relpath=''):
            result = []
            for name in root.listDirectory():
                path = '%s/%s' % (relpath, name)
                if IResourceDirectory.providedBy(root[name]):
                    item = {
                        'title': name,
                        'key': path,
                        'isFolder': True
                    }
                    item['children'] = getFolder(root[name], path)
                else:
                    item = {'title': name, 'key': path}
                result.append(item)
            return result
        return json.dumps([{
            'title': '/',
            'key': '/',
            'isFolder': True,
            "expand": True,
            'children': getFolder(self.context)
        }])

