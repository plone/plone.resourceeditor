from setuptools import setup, find_packages

version = '1.0.1'

setup(
    name='plone.resourceeditor',
    version=version,
    description="Plone resource editor",
    long_description=open("README.rst").read() + "\n" +
                   open("CHANGES.rst").read(),
    classifiers=[
        "Framework :: Plone",
        "Framework :: Plone :: 4.3",
        "License :: OSI Approved :: GNU General Public License (GPL)",
        "Programming Language :: Python",
        "Programming Language :: Python :: 2.6",
        "Programming Language :: Python :: 2.7",
    ],
    keywords='resource editor',
    author='Martin Aspeli, Plone Foundation',
    author_email='optilude@gmail.com',
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
