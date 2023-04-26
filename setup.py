from setuptools import find_packages
from setuptools import setup


version = "4.0.0"

setup(
    name="plone.resourceeditor",
    version=version,
    description="Integrates ACE editor into Plone",
    long_description=(open("README.rst").read() + "\n" + open("CHANGES.rst").read()),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Framework :: Plone",
        "Framework :: Plone :: 6.0",
        "Framework :: Plone :: Core",
        "License :: OSI Approved :: GNU General Public License (GPL)",
        "Programming Language :: Python",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
    keywords="ace resource editor",
    author="Plone Foundation",
    author_email="plone-developers@lists.sourceforge.net",
    url="https://github.com/plone/plone.resourceeditor",
    license="GPL",
    packages=find_packages(),
    namespace_packages=["plone"],
    include_package_data=True,
    zip_safe=False,
    python_requires=">=3.8",
    install_requires=[
        "plone.base",
        "plone.resource",
        "plone.staticresources",
        "setuptools",
        "Products.CMFCore",
        "Zope",
    ],
    extras_require={"test": ["plone.app.testing"]},
    entry_points="""
    """,
)
