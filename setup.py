from setuptools import setup, find_packages

version = '3.0.4.dev0'

setup(
    name='plone.resourceeditor',
    version=version,
    description="Integrates ACE editor into Plone",
    long_description=(
        open("README.rst").read() +
        "\n" +
        open("CHANGES.rst").read()
    ),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Framework :: Plone",
        "Framework :: Plone :: 5.2",
        "Framework :: Plone :: Core",
        "License :: OSI Approved :: GNU General Public License (GPL)",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3.6",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        ],
    keywords='ace resource editor',
    author='Plone Foundation',
    author_email='plone-developers@lists.sourceforge.net',
    url='https://github.com/plone/plone.resourceeditor',
    license='GPL',
    packages=find_packages(),
    namespace_packages=['plone'],
    include_package_data=True,
    zip_safe=False,
    install_requires=[
        'plone.staticresources',
        'setuptools',
        'six',
        'zope.component',
        'zope.interface',
        'zope.publisher',
        'zope.schema',
        'Zope2',
    ],
    extras_require={
        'test': ['plone.app.testing']
    },
    entry_points="""
    """,
)
