using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEngine.Rendering;
using UnityEditor;
using UnityEditor.Build;
// WFA 2.0
namespace WFA
{
  public static class renderPipelineDetector
  {
    private static int int0;
    private static bool isUpdateHooked;
    private static bool hasRunDetectionThisReload;

    public const string TAG_HDRP = "USING_HDRP";
    public const string TAG_URP = "USING_URP";
    public const string TAG_BRP = "USING_BRP";

    private const string CS_CLASSNAME = "renderPipelineDetector0";
    private const string CS_FILENAME = CS_CLASSNAME + ".cs";

    private static void detectRP()
    {
      bool hasHDRP = false;
      bool hasURP = false;
      bool hasBRP = false;

      if (GraphicsSettings.currentRenderPipeline)
      {
        if (GraphicsSettings.currentRenderPipeline.GetType().ToString().Contains("HighDefinition"))
        {
          //HDRP active
          hasHDRP = true;
        }
        else
        {
          //URP active
          hasURP = true;
        }
      }
      else
      {
        //Built-in RP active
        hasBRP = true;
      }

      DefinePreProcessors(hasHDRP, hasURP, hasBRP);
      SaveToFile(CSharpFileCode(hasHDRP, hasURP, hasBRP));
    }

    private static void DefinePreProcessors(bool defineHDRP, bool defineURP, bool defineBRP)
    {
      string originalDefineSymbols;
      string newDefineSymbols;

      List<string> defined;
      BuildTargetGroup platform = EditorUserBuildSettings.selectedBuildTargetGroup;

      string log = string.Empty;

      originalDefineSymbols =
#if UNITY_2021_2_OR_NEWER
        PlayerSettings.GetScriptingDefineSymbols(NamedBuildTarget.FromBuildTargetGroup(platform));
#else
        PlayerSettings.GetScriptingDefineSymbolsForGroup(platform);
#endif
      defined = originalDefineSymbols.Split(';').Where(x => !String.IsNullOrWhiteSpace(x)).ToList();

      Action<bool, string> AppendRemoveTag = (stat, tag) =>
      {
        if (stat && !defined.Contains(tag))
          defined.Add(tag);
        else if (!stat && defined.Contains(tag))
          defined.Remove(tag);
      };

      AppendRemoveTag(defineHDRP, TAG_HDRP);
      AppendRemoveTag(defineURP, TAG_URP);
      AppendRemoveTag(defineBRP, TAG_BRP);

      newDefineSymbols = string.Join(";", defined);
      if (originalDefineSymbols != newDefineSymbols)
      {
        var defines = newDefineSymbols;
#if UNITY_2021_2_OR_NEWER
        PlayerSettings.SetScriptingDefineSymbols(NamedBuildTarget.FromBuildTargetGroup(platform), defines);
#else
        PlayerSettings.SetScriptingDefineSymbolsForGroup(platform, defines);
#endif
      }
    }

    private static void SaveToFile(string Code)
    {
      var directory = Directory.GetParent(new System.Diagnostics.StackTrace(true).GetFrame(0).GetFileName());
      if (directory != null && directory.Parent != null)
        directory = directory.Parent;

      string string1 = "/Scripts" + "/" + CS_FILENAME;

      string path = directory.FullName + string1;

      if (File.Exists(path))
      {
        string existing = File.ReadAllText(path);
        if (string.Equals(existing, Code, StringComparison.Ordinal))
          return;
      }

      File.WriteAllText(path, Code);
    }

    private static string CSharpFileCode(bool defineHDRP, bool defineURP, bool defineBRP)
    {
      Func<bool, string> ToString = (b) => b ? "true" : "false";

      return "namespace AG_WebGLFPSAccelerator\n" +
      "{\n" +
          $"\tpublic static class {CS_CLASSNAME}\n" +
          "\t{\n\n" +

              $"\t\tpublic const bool USING_HDRP = {ToString(defineHDRP)};\n\n" +

              $"\t\tpublic const bool USING_URP = {ToString(defineURP)};\n\n" +

              $"\t\tpublic const bool USING_BRP = {ToString(defineBRP)};\n\n" +

          "\t}\n" +
      "}";
    }

    [UnityEditor.Callbacks.DidReloadScripts]
    static void MyClass()
    {
      int0 = 0;
      hasRunDetectionThisReload = false;

      if (!isUpdateHooked)
      {
        EditorApplication.update += Update;
        isUpdateHooked = true;
      }
    }

    static void Update()
    {
      if (hasRunDetectionThisReload)
      {
        if (isUpdateHooked)
        {
          EditorApplication.update -= Update;
          isUpdateHooked = false;
        }
        return;
      }

      int0++;

      if (int0 >= 10)
      {
        hasRunDetectionThisReload = true;
        detectRP();
      }
    }
  }
}
