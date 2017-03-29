# How to apply translations to XBlocks

There are 3 main methods in order to have XBlocks localized. 
Two of them are not recommended since they have an approach that makes it
difficult to maintain over time but are reported here for sake of clarity.

1. ## Explicitely tell Django where the XBlock's translations files are
   located. [Recommended]

    In order to do so, it is necessary to modify the `LOCALE_PATHS` that Django
    controls at startup. If we programmatically add the paths of all the XBlocks
    that have a translation setup in place, Django will read from those folders and
    will apply the translations consequently. 

    This is the code related to the add:

    ```python
    def enable_locale_discovery():
        """ 
        Enables Django to see and apply the translations in the XBlocks
        After retrying all the xblocks currently installed, it checks whether a
        `translations` folder exists and adds it to the LOCALE_PATHS list. 
        """
        import inspect, os
        from xblock.core import XBlock

        # Folder name where the XBlocks' translations are located
        locale_folder = 'translations'
        # Retry list of loaded XBlocks
        xblocks_list = XBlock.load_classes()
        for name, class_  in xblocks_list:
            # For each XBlock, get the absolute path of the compiled file 
            xblock_install_path = inspect.getfile(class_)
            # Paths have a recurrent form:
            # `/edx/app/edxapp/<install_path>/<xblock>/<xblock>/xblock.pyc`
            # Strip first '/edx/app/edxapp/' and last 'xblock.pyc' from the path
            stripped_path = xblock_install_path.split('/edx/app/edxapp/',1)[1].rsplit('/',1)[0]
            # Build path using ENV_ROOT
            translated_url = settings.ENV_ROOT / stripped_path / locale_folder
            # Check if the folder exists and if it is not empty
            if(os.path.isdir(translated_url) and os.listdir(translated_url)):
                # Check for unicity and then add to LOCALE_PATHS
                if(translated_url not in settings.LOCALE_PATHS):
                    settings.LOCALE_PATHS = ( translated_url , ) + settings.LOCALE_PATHS
    ```


2. ## Use the Django App [Not recommended]

    Follow the README I wrote here
    [django-xblock-i18n app](https://github.com/libremente/django-xblock-i18n)


3. ## Merge `.po` files [Not recommended]

    For each XBlock to be localized, apply the following passages:

    * Extract the strings to be localized from all the files like e.g. `.py` and
      `.js` ones. For `python`:

      ```bash
      $ find . -name "*.py" | xargs  xgettext --language=python --add-comments="Translators:"
      ```

      For `javascript`:
      
      ```bash
      $ find . -name "*.js" -o  -path  ./public/js/vendor -prune -a -type f | xargs xgettext --language=javascript
      --from-code=utf-8 --add-comments="Translators:"
      ```

      Note that each command generates a `message.po` file, so after running the
      first time make sure to `mv` the file to another name. 

      NB: there is the possibility of adding `--join-existing` to the second
      command but, at the moment of writing, it is not working on my machine.
      That should help appending the
      second output to the first `message.po` file. 

      Anyway, Django expects to have a `django.{po,mo}` file in its locale
      directory which means that those `messages.{po,mo}` files have to be renamed. 

      For our case, all the strings extracted from `python` should exist in the
      `django.po` file, whilst the ones related to `javascript` should be inserted
      inside the `djangojs.po` file.
      
      To check if `django.po` is correct, you can run `msgfmt` to build
      a `django.mo` file:
      ```bash
      $ msgfmt django.po -o django.mo 
      ```

      If everything is correct, the resulting `django.mo` file has to be move
      to the final directory:
      `translations/<lang_code>/LC_MESSAGES/django.mo`.
      Same for the `djangojs.{po,mo}` files.

    * Now that the `.po` file is generated, it is necessary to attach it to the
      platform's one located in `/conf/lang/<lang_code>/django.po`. When merging
      the two files, make sure that there are no conflicting strings (strings which
      are present in both files). If there are, remove the ones present in the new
      `django.po` file and leave the originals intact. Once the merge is finished,
      it is possible to run the command to generate the new `django.mo` file as
      before:

      ```bash
      $ msgfmt conf/locale/<lang_code>/LC_MESSAGES/django.po -o translations/<lang_code>/LC_MESSAGES/django.mo 
      ```

    * From now on, Django will read from those files and apply the translations.
