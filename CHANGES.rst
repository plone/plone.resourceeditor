Changelog
=========

.. You should *NOT* be adding new change log entries to this file.
   You should create a file in the news directory instead.
   For helpful instructions, please see:
   https://github.com/plone/plone.releaser/blob/master/ADD-A-NEWS-ITEM.rst

.. towncrier release notes start

4.0.0 (2023-04-27)
------------------

Breaking changes:


- Drop python 2.7 compatibility.
  [gforcada] (#1)


Internal:


- Update configuration files.
  [plone devs] (2a4ba395)


3.0.4 (2022-08-30)
------------------

Bug fixes:


- Fix unclosed file warnings
  [petschki] (#29)


3.0.3 (2020-09-28)
------------------

Bug fixes:


- Fixed invalid escape sequences.
  [maurits] (#3130)


3.0.2 (2020-04-22)
------------------

Bug fixes:


- Minor packaging updates. (#1)


3.0.1 (2020-03-13)
------------------

Bug fixes:


- Do not call ``processInputs``.
  It is not needed since Zope 4, and not existing in Zope 5.
  [maurits] (#26)


3.0.0 (2019-02-13)
------------------

Breaking changes:


- Move all resources for plone.staticresources. See: PLIP 1653. [thet] (#22)


Bug fixes:


- fix UnicodeDecodeError while using Build CSS in Theme Editor #2698 [MrTango]
  (#2698)


2.1.3 (2018-11-02)
------------------

Bug fixes:

- Fix UnicodeDecodeError when saving files TTW.
  [tmassman]


2.1.2 (2018-09-28)
------------------

Bug fixes:

- Fix functionality and tests in py3
  [pbauer]


2.1.1 (2018-02-02)
------------------

Bug fixes:

- Add Python 2 / 3 compatibility
  [pbauer]


2.1 (2017-07-18)
----------------

New features:

- Add the download and move endpoint to the FileManagerActions class
  [b4oshany]

- Add test cases for FileManagerAction
  [b4oshany]


2.0.6 (2017-07-03)
------------------

Fixes:

- Remove  unittest2 dependency
  [kakshay21]
- Split the error message for the move API endpoint into two. One
  is for the parent folder and the other is for the destination folder
  [b4oshany]
- Fix Jenkins flake8 errors


[b4oshany]: https://github.com/b4oshany

2.0.5 (2016-03-31)
------------------

Fixes:

- Cleanup code according to Plone style guide.
  [gforcada]

- Do not crash on saving in FilesystemResourceDirectory, and return the file
  content as 'tmp'.
  [ebrehault]


2.0.4 (2015-10-28)
------------------

Fixes:

- No longer rely on deprecated ``bobobase_modification_time`` from
  ``Persistence.Persistent``.
  [thet]

- Minor cleanup: pep8, readability, ReST.
  [jensens]

- Fixed problem causing file timestamps to show up incorrectly.
  [obct537]

- Fixed error preventing file saving in the filemanager.
  [obct537]


2.0.3 (2015-09-27)
------------------

- handle NotFound errors while generating file/folder listings
  [vangheem]


2.0.2 (2015-09-08)
------------------

- Added check to prevent overwriting folders when saving
  [obct537]

2.0.1 (2015-08-22)
------------------

- Added ability to convert absolute to relative urls
  [obct537]

- Fixed issue with ascii encoding
  [obct537]

- now properly serves filesystem files to the thememapper
  [obct537]

- resourceeditor will now register non-standard mimetypes in the python
  mimetype module
  [obct537]


2.0.0 (2015-03-21)
------------------

- move to mockup based file manager. Plone 5 only here.
  [vangheem]


1.0 (2013-05-23)
----------------

- make sure theme is disable
  [vangheem]

- do not set value inside of pre tag since it can go crazy on some markup
  [vangheem]


1.0b4 (2013-01-01)
------------------

- Fixed a bug with saving files containing non-ASCII characters.
  [optilude]


1.0b3 (2012-10-16)
------------------

- Fix right click menu bug
  [optilude]

- Upgrade to latest version of ACE
  [optilude]


1.0b2 (2012-08-08)
------------------

- Upgrade to version 1.0 of the ACE editor
  [optilude]


1.0b1 (2012-08-08)
------------------

- Initial release
  [optilude]
