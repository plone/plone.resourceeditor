from setuptools import setup, find_packages

version = '2.0.3'

setup(name='plone.resourceeditor',
      version=version,
      description="",
      long_description=open("README.txt").read() + "\n" +
                       open("CHANGES.txt").read(),
      classifiers=[
        "Framework :: Plone",
        "Programming Language :: Python",
        ],
      keywords='',
      author='',
      author_email='',
      url='https://github.com/plone/plone.resourceeditor',
      license='GPL',
      packages=find_packages(exclude=['ez_setup']),
      namespace_packages=['plone'],
      include_package_data=True,
      zip_safe=False,
      install_requires=[
          'setuptools',
          'zope.interface',
          'zope.component',
          'zope.publisher',
          'zope.schema',
          'plone.resource',
          'Zope2',
      ],
      extras_require = {
          'test': ['plone.app.testing']
      },
      entry_points="""
      """,
      )
