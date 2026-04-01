using UnityEngine;
using System.IO;
using System;
using UnityEditor;
// WFA 2.0
public class wfaEditor : AssetPostprocessor
{
  static bool checkDevMode()
  {
    bool devMode = false;

    DirectoryInfo directory = Directory.GetParent(Application.dataPath);
    var folder = directory.ToString() + "/Assets";
    var filePath = findFilePath(folder, "developerMode.txt");

    if (File.Exists(filePath))
    {
      Debug.Log("developer mode on");
      devMode = true;
    }

    return devMode;
  }

  static void m1()
  {
    DirectoryInfo directory = Directory.GetParent(Application.dataPath);
    var scriptsFolder = directory.ToString() + "/Assets/WebGL FPS Accelerator/Scripts";
    var filePath = findFilePath(scriptsFolder, "WebGLFPSAccelerator.cs");

    var fileRawText = File.ReadAllText(filePath);

    string string0 = @"
        //obj.textDPI = textDPI;
        //obj.wfaDPI = DPI.value;
";

    string string1 = @"
        obj.textDPI = textDPI;
        obj.wfaDPI = DPI.value;
    ";

    if (checkDevMode())
    {
      var string2 = string0;
      string0 = string1;
      string1 = string2;
    }

    if (!fileRawText.Contains(string0))
      return;

    fileRawText = fileRawText.Replace(string0, string1);
    File.WriteAllText(filePath, fileRawText);
  }

  static void m0()
  {
    DirectoryInfo directory = Directory.GetParent(Application.dataPath);
    var PackageCache = directory.ToString() + "/Library/PackageCache";
    var path = findFilePath(PackageCache, "Text.cs");

    var text = File.ReadAllText(path);

    string string1 = @"
        public float textDPI = 1;
        public float wfaDPI = 1;
        public float lastWfaDPI = 1;
        public float lastPixelsPerUnit = 1;

        public float pixelsPerUnit
        {
            get
            {
                if ((int)(wfaDPI*10) == (int)(lastWfaDPI*10))
                {
                    return lastPixelsPerUnit * textDPI;
                }

                lastWfaDPI = wfaDPI;

                var localCanvas = canvas;
                float float1 = 0;

                if (!localCanvas)
                {
                    float1 = 1;
                    lastPixelsPerUnit = float1;
                    return float1 * textDPI;
                }
                if (!font || font.dynamic)
                {
                    float1 = localCanvas.scaleFactor;
                    lastPixelsPerUnit = float1;
                    return float1 * textDPI;
                }
                if (m_FontData.fontSize <= 0 || font.fontSize <= 0)
                {
                    float1 = 1;
                    lastPixelsPerUnit = float1;
                    return float1 * textDPI;
                }

                float1 = (font.fontSize / (float)m_FontData.fontSize);
                lastPixelsPerUnit = float1;
                return float1 * textDPI;
            }
        }
        public float xxx
";

    if (text.Contains(string1))
      return;

    text = text.Replace("public float pixelsPerUnit", string1);

    File.WriteAllText(path, text);
  }

  [UnityEditor.Callbacks.DidReloadScripts]
  static void DidReloadScripts0()
  {
    if (!checkDevMode())
      m0();

    m1();
  }

  public static String findFilePath(string path, string fileName)
  {
    string[] res = Directory.GetFiles(path, fileName, SearchOption.AllDirectories);
    string res2 = res.Length > 0 ? res[0] : "";
    return res2;
  }

  void OnPreprocessAsset()
  {
    if (!checkDevMode())
      m0();
  }

  static void OnPostprocessAllAssets(string[] importedAssets, string[] deletedAssets, string[] movedAssets, string[] movedFromAssetPaths)
  {
    if (!checkDevMode())
      m0();
  }
}