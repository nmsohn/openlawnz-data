# MS Word macro

## Set up

1. Open MS Word (2016 onwards - it may work in others though)
2. View -> Macros -> Create -> ExtractFootnotes
3. Delete all the code inside the macro it makes you
4. Copy the contents of `ExtractFootnotes.vbs` and paste it in the macro
5. Do the same with `Document_New.vbs`
6. Save the file somewhere as `(anyfilename).dotm` - remember it's `.dotm`
7. Put the path to the `.dotm` file in the `adapterconfig.json` file

NOTE: You may need to enable macros if it prompts you.