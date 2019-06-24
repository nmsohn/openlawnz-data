Sub ExtractFootnotes()

    On Error GoTo ProcError
    
    templateName = ActiveDocument.AttachedTemplate.FullName
    
    ActiveDocument.Close False
    Application.Documents.Open Replace(templateName, ".dotm", ".docx")
    
    originalName = ActiveDocument.FullName

    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    '
    ' Save as text and reopen
    '
    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''

    textStrName = Replace(ActiveDocument.FullName, ".docx", ".txt")
    ActiveDocument.SaveAs FileName:=textStrName, FileFormat:=wdFormatText, AllowSubstitutions:=False, Encoding:=65001
    ActiveDocument.Close False
    Application.Documents.Open originalName
    
    'Application.ScreenUpdating = False
    
    
    
    
    
    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    '
    ' Footnotes
    ' Find line shapes on the page because chances are footnotes are under them
    ' Take the text under the shape and append to a string
    '
    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    
    Dim footnoteStream
    
    Set footnoteStream = CreateObject("ADODB.Stream")
    footnoteFilename = (Replace(ActiveDocument.FullName, ".docx", ".footnotes.txt"))
    footnoteStream.Open
    footnoteStream.Type = 2     'text
    footnoteStream.Position = 0
    footnoteStream.Charset = "utf-8"
    
    Dim footnotes As String
    
    Dim totalPages As Integer
    totalPages = ActiveDocument.Range.Information(wdNumberOfPagesInDocument)
    
    
    
    
    
    ' If multiple images, get the one furthest down the page
    
    Dim pageShapesDictionary As Scripting.Dictionary
    Set pageShapesDictionary = CreateObject("Scripting.Dictionary")
    
    For Each pageShape In ActiveDocument.Shapes
        Dim sPageNumber
        sPageNumber = pageShape.Anchor.Information(wdActiveEndPageNumber)
        If pageShapesDictionary.Exists(sPageNumber) Then
            If pageShape.Anchor.Information(wdVerticalPositionRelativeToPage) > pageShapesDictionary(sPageNumber).Anchor.Information(wdVerticalPositionRelativeToPage) Then
                pageShapesDictionary.Remove (sPageNumber)
                pageShapesDictionary.Add sPageNumber, pageShape
            End If
        Else
            pageShapesDictionary.Add sPageNumber, pageShape
        End If
        
    Next pageShape
    
    
    
    
    
    ' Order page shapes
    ' Shapes may be out of order with pages
    
    Dim orderedPageShapes As Scripting.Dictionary
    Set orderedPageShapes = CreateObject("Scripting.Dictionary")
    
    Dim orderedPageStart As Integer
    orderedPageStart = 1 ' Pages start at 1
    
    Do While totalPages >= orderedPageStart
        If pageShapesDictionary.Exists(orderedPageStart) Then
            orderedPageShapes.Add orderedPageStart, pageShapesDictionary.Item(orderedPageStart)
        End If
        orderedPageStart = orderedPageStart + 1
    Loop
    
    
    
    
    
    ' Footnote shapes
    ' Iterate through all ordered page shapes
    
    Dim footnoteShapesDictionary
    Set footnoteShapesDictionary = CreateObject("Scripting.Dictionary")
    
    ' Assuming one line per page after the first page
    
    For Each orderedPageShapeKey In orderedPageShapes.Keys
        
        Dim s As Shape
        Set s = orderedPageShapes.Item(orderedPageShapeKey)
        
        Dim sTopPosition
        sTopPosition = s.Anchor.Information(wdVerticalPositionRelativeToPage)
        
        ' From the first shape that is the correct dimension, add
        
        If (footnoteShapesDictionary.Count > 0 Or (Application.CentimetersToPoints(s.Width) < 4084) And s.Left < 200) Then
            
            footnoteShapesDictionary.Add orderedPageShapeKey, sTopPosition
            
        End If
        
    Next orderedPageShapeKey
    
    
    
    
    
    ' Go through all paragraphs and if they are under a footnote shape, add
    
    For Each p In ActiveDocument.Paragraphs
        
        Dim r As Double
        
        r = p.Range.Information(wdVerticalPositionRelativeToPage)
        
        For Each shapeKey In footnoteShapesDictionary.Keys
        
            If shapeKey = p.Range.Information(wdActiveEndPageNumber) Then
                
                ' Check if the first character of the footnotes is a number (helps with names as the last text under an underline)
                If r > footnoteShapesDictionary.Item(shapeKey) And IsNumeric(p.Range.Characters.First) Then
                    footnotes = footnotes & p.Range.Text
                    
                    ' Colour blue so that the footnote context search ignores it
                    p.Range.Font.Shading.BackgroundPatternColor = wdColorBlue
                End If
                
            End If
        
        Next shapeKey
        
    Next p
    
    
    
    
    
    ' Short circuit if there's no footnotes
    
    If Len(footnotes) = 0 Then
        ActiveDocument.Close False
        Application.Quit
    Else
    
        footnoteStream.WriteText footnotes
        footnoteStream.SaveToFile footnoteFilename, 2
    
    End If
    
    
    
    
    
    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    '
    ' Footnote contexts
    ' Find what looks like footnote references
    ' They might be superscript, or small and formatted
    '
    '''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
    
    
    
    
    
    Dim footnoteReferencesStream
    Set footnoteReferencesStream = CreateObject("ADODB.Stream")
    footnoteReferencesFilename = (Replace(ActiveDocument.FullName, ".docx", ".footnotecontexts.txt"))
    footnoteReferencesStream.Open
    footnoteReferencesStream.Type = 2     'text
    footnoteReferencesStream.Position = 0
    footnoteReferencesStream.Charset = "utf-8"
    
    startedFootnoteContextsStreaming = False
    
    Dim findContextResults As Scripting.Dictionary
    Set findContextResults = CreateObject("Scripting.Dictionary")
    
    Set footnoteContextContentRange = ActiveDocument.Content
    
    
    
    
    
    ' Find superscript
    
    With footnoteContextContentRange.Find.Font
        .Superscript = True
    End With
    
    With footnoteContextContentRange.Find
        .Text = "[0-9]{1,3}"
        .MatchWildcards = True
    End With
    
    footnoteContextContentRange.Find.Execute
    
    While footnoteContextContentRange.Find.Found
        Set myRange = ActiveDocument.Range(Start:=footnoteContextContentRange.Start - 10, End:=footnoteContextContentRange.Start + Len(footnoteContextContentRange.Text))
        findContextResults.Add CInt(footnoteContextContentRange.Text), Trim(Replace(myRange.Text, vbCr, ""))
        Selection.MoveRight Unit:=wdCharacter, Count:=Len(footnoteContextContentRange.Text)
        footnoteContextContentRange.Find.Execute
    Wend
    
    
    
    
    
    ' Find fonts between range
    
    Dim min
    min = 6
    
    Dim max
    max = 8
    
    Dim currentFontSize
    currentFontSize = min
    
    Do While max >= currentFontSize
        
        Selection.HomeKey Unit:=wdStory
        Set footnoteContextContentRange = ActiveDocument.Content
        
        With footnoteContextContentRange.Find.Font
            .Size = currentFontSize
        End With
        
        With footnoteContextContentRange.Find.Font.Shading
            .ForegroundPatternColor = wdColorAutomatic
        End With
        
        With footnoteContextContentRange.Find
            .Text = "[0-9]{1,3}"
            .MatchWildcards = True
            .Wrap = wdFindStop
        End With
        
        footnoteContextContentRange.Find.Execute
        
        While footnoteContextContentRange.Find.Found
            If footnoteContextContentRange.Font.Position > 2 Then
                Set myRange = ActiveDocument.Range(Start:=footnoteContextContentRange.Start - 10, End:=footnoteContextContentRange.Start + Len(footnoteContextContentRange.Text))
                findContextResults.Add CInt(footnoteContextContentRange.Text), Trim(Replace(myRange.Text, vbCr, ""))
            End If
            'Selection.MoveRight Unit:=wdCharacter, Count:=Len(footnoteContextContentRange.Text)
            footnoteContextContentRange.Collapse wdCollapseEnd
            footnoteContextContentRange.Find.Execute
        Wend
        
        currentFontSize = currentFontSize + 0.5
        
    Loop
    
    
    
    
    
    ' Order results
    ' The find of different font sizes/style may be out of page order

    Set orderedFindContextResults = CreateObject("Scripting.Dictionary")
    Dim orderedFindContextStart
    orderedFindContextStart = 1

    Do While findContextResults.Exists(orderedFindContextStart)
        orderedFindContextResults.Add orderedFindContextStart, findContextResults.Item(orderedFindContextStart)
        orderedFindContextStart = orderedFindContextStart + 1
    Loop
    
    
    
    
    
    ' Write file
    
    If (orderedFindContextResults.Count > 0) Then
    
        For Each resultKey In orderedFindContextResults.Keys
        
            If startedFootnoteContextsStreaming Then
                footnoteReferencesStream.WriteText vbCrLf
            End If
    
            startedFootnoteContextsStreaming = True
    
            footnoteReferencesStream.WriteText orderedFindContextResults.Item(resultKey)
        
        Next resultKey
        
        footnoteReferencesStream.SaveToFile footnoteReferencesFilename, 2
    
    End If
    
    
    
    
    
ProcExit:
    
    If (Not IsNull(footnoteStream)) Then
        footnoteStream.Close
    End If
    
    If (Not IsNull(footnoteReferencesStream)) Then
        footnoteReferencesStream.Close
    End If
    
    ActiveDocument.Close False
    Application.Quit

Exit Sub

ProcError:
    Resume ProcExit
    
End Sub
