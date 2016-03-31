Changelog
=========

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

- Added check to prevent overwritting folders when saving
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
