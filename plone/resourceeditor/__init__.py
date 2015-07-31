import os.path
import mimetypes

# Borrowed from zope.contenttype.
# This allows us to register mimetypes that
# aren't included in python by default
#
# To add additional mimetypes, include a line in mime.types


def add_files(filenames):
    if mimetypes.inited:
        mimetypes.init(filenames)
    else:
        mimetypes.knownfiles.extend(filenames)


here = os.path.dirname(os.path.abspath(__file__))
add_files([os.path.join(here, "mime.types")])
