import unittest2 as unittest

from plone.resourceeditor.testing import PLONE_RESOURCE_EDITOR_INTEGRATION_TESTING


class TestResourceEditorOperations(unittest.TestCase):

    layer = PLONE_RESOURCE_EDITOR_INTEGRATION_TESTING

    def _make_directory(self, resourcetype='theme', resourcename='mytheme'):
        from plone.resource.interfaces import IResourceDirectory
        from zope.component import getUtility

        resources = getUtility(IResourceDirectory, name='persistent')
        resources.makeDirectory(resourcetype)
        resources[resourcetype].makeDirectory(resourcename)

        return resources[resourcetype][resourcename]

    def test_getinfo(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        r.writeFile("test.txt", "A text file")

        view = FileManager(r, self.layer['request'])
        info = view.getInfo('/test.txt')

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['fileType'], 'txt')
        self.assertEqual(info['filename'], 'test.txt')
        self.assertEqual(info['path'], '/test.txt')

    def test_getfolder(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        r.makeDirectory('alpha')
        r['alpha'].writeFile('beta.txt', "Beta")
        r['alpha'].makeDirectory('delta')
        r['alpha']['delta'].writeFile('gamma.css', "body {}")

        view = FileManager(r, self.layer['request'])
        info = view.getFolder('/alpha')

        self.assertEqual(len(info), 2)

        self.assertEqual(info[0]['code'], 0)
        self.assertEqual(info[0]['error'], '')
        self.assertEqual(info[0]['fileType'], 'dir')
        self.assertEqual(info[0]['filename'], 'delta')
        self.assertEqual(info[0]['path'], '/alpha/delta')

        self.assertEqual(info[1]['code'], 0)
        self.assertEqual(info[1]['error'], '')
        self.assertEqual(info[1]['fileType'], 'txt')
        self.assertEqual(info[1]['filename'], 'beta.txt')
        self.assertEqual(info[1]['path'], '/alpha/beta.txt')

    def test_addfolder(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        info = view.addFolder('/', 'alpha')

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['parent'], '/')
        self.assertEqual(info['name'], 'alpha')

        info = view.addFolder('/alpha', 'beta')

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['parent'], '/alpha')
        self.assertEqual(info['name'], 'beta')

    def test_addfolder_exists(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory('alpha')

        view = FileManager(r, self.layer['request'])

        info = view.addFolder('/', 'alpha')

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['parent'], '/')
        self.assertEqual(info['name'], 'alpha')

    def test_addfolder_invalid_name(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory('alpha')

        view = FileManager(r, self.layer['request'])

        for char in '\\/:*?"<>':
            info = view.addFolder('/', 'foo' + char)

            self.assertEqual(info['code'], 1)
            self.assertNotEqual(info['error'], '')
            self.assertEqual(info['parent'], '/')
            self.assertEqual(info['name'], 'foo' + char)

    def test_addfolder_invalid_parent(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        info = view.addFolder('/alpha', 'beta')

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['parent'], '/alpha')
        self.assertEqual(info['name'], 'beta')

    def test_add(self):
        from plone.resourceeditor.browser import FileManager
        from StringIO import StringIO
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        d = StringIO("foo")
        d.filename = "test.txt"

        info = view.add("/", d)

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['name'], 'test.txt')
        self.assertEqual(info['path'], '/')
        self.assertEqual(info['parent'], '/')

    def test_add_subfolder(self):
        from plone.resourceeditor.browser import FileManager
        from StringIO import StringIO
        r = self._make_directory()
        r.makeDirectory("alpha")

        view = FileManager(r, self.layer['request'])

        d = StringIO("foo")
        d.filename = "test.txt"

        info = view.add("/alpha", d)

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['name'], 'test.txt')
        self.assertEqual(info['path'], '/alpha')
        self.assertEqual(info['parent'], '/alpha')

    def test_add_exists(self):
        from plone.resourceeditor.browser import FileManager
        from StringIO import StringIO
        r = self._make_directory()
        r.writeFile("test.txt", "boo")

        view = FileManager(r, self.layer['request'])

        d = StringIO("foo")
        d.filename = "test.txt"

        info = view.add("/", d)

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')

        self.assertEqual(r.readFile("test.txt"), "boo")

    def test_add_replace(self):
        from plone.resourceeditor.browser import FileManager
        from StringIO import StringIO
        r = self._make_directory()
        r.writeFile("test.txt", "boo")

        view = FileManager(r, self.layer['request'])

        d = StringIO("foo")
        d.filename = "test.txt"

        info = view.add("/", d, "/test.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['name'], 'test.txt')
        self.assertEqual(info['path'], '/')
        self.assertEqual(info['parent'], '/')

        self.assertEqual(r.readFile("test.txt"), "foo")

    def test_addnew(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        info = view.addNew("/", "test.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['name'], 'test.txt')
        self.assertEqual(info['parent'], '/')

        self.assertEqual(r.readFile("test.txt"), "")

    def test_addnew_exists(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.addNew("/", "test.txt")

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')

        self.assertEqual(r.readFile("test.txt"), "foo")

    def test_addnew_invalidname(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        for char in '\\/:*?"<>':
            info = view.addNew("/", "foo" + char)
            self.assertEqual(info['code'], 1)
            self.assertNotEqual(info['error'], '')

    def test_rename(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.rename("/test.txt", "foo.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['oldName'], 'test.txt')
        self.assertEqual(info['newName'], 'foo.txt')
        self.assertEqual(info['oldParent'], '/')
        self.assertEqual(info['newParent'], '/')

        self.assertEqual(r.readFile("foo.txt"), "foo")

    def test_rename_subfolder(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory("alpha")
        r['alpha'].writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.rename("/alpha/test.txt", "foo.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['oldName'], 'test.txt')
        self.assertEqual(info['newName'], 'foo.txt')
        self.assertEqual(info['oldParent'], '/alpha')
        self.assertEqual(info['newParent'], '/alpha')

        self.assertEqual(r['alpha'].readFile("foo.txt"), "foo")

    def test_rename_exists(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")
        r.writeFile("foo.txt", "bar")

        view = FileManager(r, self.layer['request'])

        info = view.rename("/test.txt", "foo.txt")

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['oldName'], 'test.txt')
        self.assertEqual(info['newName'], 'foo.txt')
        self.assertEqual(info['oldParent'], '/')
        self.assertEqual(info['newParent'], '/')

        self.assertEqual(r.readFile("foo.txt"), "bar")

    def test_delete(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.delete("/test.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['path'], '/test.txt')

        self.assertFalse('test.txt' in r)

    def test_delete_subfolder(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory('alpha')
        r['alpha'].writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.delete("/alpha/test.txt")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['path'], '/alpha/test.txt')

        self.assertFalse('test.txt' in r['alpha'])

    def test_delete_notfound(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()

        view = FileManager(r, self.layer['request'])

        info = view.delete("/test.txt")

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['path'], '/test.txt')

    def test_move(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory("alpha")
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.move("/test.txt", "/alpha")

        self.assertEqual(info['code'], 0)
        self.assertEqual(info['error'], '')
        self.assertEqual(info['newPath'], '/alpha/test.txt')

        self.assertFalse('test.txt' in r)
        self.assertEqual("foo", r['alpha'].readFile('test.txt'))

    def test_move_exists(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.makeDirectory("alpha")
        r['alpha'].writeFile("test.txt", "bar")
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.move("/test.txt", "/alpha")

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['newPath'], '/alpha/test.txt')

        self.assertTrue('test.txt' in r)
        self.assertEqual("bar", r['alpha'].readFile('test.txt'))

    def test_move_invalid_parent(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])

        info = view.move("/test.txt", "/alpha")

        self.assertEqual(info['code'], 1)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['newPath'], '/alpha/test.txt')

        self.assertTrue('test.txt' in r)

    def test_download(self):
        from plone.resourceeditor.browser import FileManager
        r = self._make_directory()
        r.writeFile("test.txt", "foo")

        view = FileManager(r, self.layer['request'])
        self.assertEqual("foo", view.download("/test.txt"))
