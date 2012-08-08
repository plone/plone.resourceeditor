from plone.app.testing import PloneSandboxLayer
from plone.app.testing import PLONE_FIXTURE
from plone.app.testing import IntegrationTesting
from plone.app.testing import applyProfile

from zope.configuration import xmlconfig


class PloneResourceEditor(PloneSandboxLayer):
    defaultBases = (PLONE_FIXTURE,)

    def setUpZope(self, app, configurationContext):
        # Load ZCML
        import plone.resourceeditor
        xmlconfig.file('configure.zcml', plone.resourceeditor, context=configurationContext)

    def setUpPloneSite(self, portal):
        # install plone.resource
        applyProfile(portal, 'plone.resource:default')

PLONE_RESOURCE_EDITOR_FIXTURE = PloneResourceEditor()
PLONE_RESOURCE_EDITOR_INTEGRATION_TESTING = \
    IntegrationTesting(bases=(PLONE_RESOURCE_EDITOR_FIXTURE,), name="plone.resourceeditor:Integration")
