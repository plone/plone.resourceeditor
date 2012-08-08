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

        self.assertEqual(info['code'], 2)
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

        self.assertEqual(info['code'], 4)
        self.assertNotEqual(info['error'], '')
        self.assertEqual(info['parent'], '/alpha')
        self.assertEqual(info['name'], 'beta')

    def test_add(self):
        r = self._make_directory()

    def test_add_exists(self):
        r = self._make_directory()

    def test_add_replace(self):
        r = self._make_directory()

    def test_addnew(self):
        r = self._make_directory()

    def test_addnew_exists(self):
        r = self._make_directory()

    def test_addnew_invalidname(self):
        r = self._make_directory()

    def test_rename(self):
        r = self._make_directory()

    def test_rename_exists(self):
        r = self._make_directory()

    def test_delete(self):
        r = self._make_directory()

    def test_delete_notfound(self):
        r = self._make_directory()

    def test_move(self):
        r = self._make_directory()

    def test_move_exists(self):
        r = self._make_directory()

    def test_download(self):
        r = self._make_directory()
