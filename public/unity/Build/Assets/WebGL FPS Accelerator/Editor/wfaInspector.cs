using UnityEngine;
using UnityEditor;
using WFA;
using WFA.utilities;
// WFA 2.0
[CustomEditor(typeof(WebGLFPSAccelerator))]
[CanEditMultipleObjects]
public class wfaInspector : Editor
{
  public static serializer fpsMin;
  public static serializer fpsMax;
  public static serializer dpi;
  public static serializer resolutionSystem;
  public static serializer dpiMin;
  public static serializer dpiMax;
  public static serializer downSamplingSystem;
  public static serializer dpiIncrement;
  public static serializer dpiDecrement;
  public static serializer fixedDPI;
  public static serializer measurePeriod;
  public static serializer showUI;
  public static serializer textDPI;
  public static serializer mainData;
  public static serializer targetCamera;

  static bool showOptions = false;

  void OnEnable()
  {
    createSerializers();
  }

  private serializer createSerializer(string propertyName)
  {
    return new serializer
    (
      targetObject: typeof(WebGLFPSAccelerator.interFace),
      name: propertyName,
      memberType: serializer.MemberType.property
    );
  }

  private void createSerializers()
  {
    fpsMin = createSerializer("fpsMin");
    fpsMax = createSerializer("fpsMax");
    dpi = createSerializer("DPI");
    resolutionSystem = createSerializer("resolutionSystem");
    dpiMin = createSerializer("dpiMin");
    dpiMax = createSerializer("dpiMax");
    downSamplingSystem = createSerializer("downSamplingSystem");
    dpiIncrement = createSerializer("dpiIncrement");
    dpiDecrement = createSerializer("dpiDecrement");
    fixedDPI = createSerializer("fixedDPI");
    measurePeriod = createSerializer("measurePeriod");
    showUI = createSerializer("showUI");
    textDPI = createSerializer("textDPI");
    mainData = createSerializer("mainData");
    targetCamera = createSerializer("targetCamera");
  }

  private static void run()
  {
    UIElements.logo(out float float0);
    GUILayout.Space(float0);

    UIElements.drsOnOffButton();
    customInspector.space(3);

    if (WebGLFPSAccelerator.interFace.resolutionSystem == 0)
    {
      UIElements.dpiField();
      UIElements.targetFpsRangeFields();
      UIElements.dpiRangeFields();
      UIElements.dpiIncrementDecrementFields();
      UIElements.measurePeriodField();
    }
    else
    {
      UIElements.fixedDpiField();
    }

    customInspector.separatorLine(5, Color.grey, 0, 30);

    UIElements.downSamplingSystemField();

#if !USING_URP
    if (WebGLFPSAccelerator.interFace.downSamplingSystem == 0)
    {
      GUILayout.Space(10);
      UIElements.targetCameraField();
    }
#endif

    customInspector.separatorLine(5, Color.grey, 0, 30);

    showOptions = EditorGUILayout.BeginFoldoutHeaderGroup(showOptions, "Other Settings", null);
    if (showOptions)
      if (Selection.activeTransform)
      {
        GUILayout.Space(5);
        UIElements.textDPIField();
        UIElements.showUIField();
        UIElements.assetDataField();
      }

    GUILayout.Space(30);

    customInspector.buttonToInvokeMethod("HELP", typeof(wfaInspector), "help");
  }

  private static class UIElements
  {
    public static void assetDataField()
    {
      string description = @"
WFA uses a “Configuration Data” which allows users to configure WFA
parameters. by default WFA uses “wfaConfigDefault.asset” file in “Resources” directory.
You can create your own Config Data; “Assets > Create > Wfa Config” then you should
put it to this parameter “MainData”.
";

      customInspector.inspectField.objectField_Style0(mainData, "Main Data", description);
    }

    public static void showUIField()
    {
      string description = @"
Make this “true” if you want to use in-game UI to adjust parameters of WFA.
IF IT IS “FALSE”, THE UI WILL NEVER BE CREATED AND ANY CODE WILL WORK ABOUT THIS.
So you don’t need to worry about performance issues.
";

      customInspector.inspectField.boolField_Style0(showUI, "Show UI", description);
    }

    public static void textDPIField()
    {
      string description = @"
Use this parameter if you want to adjust Text Resolution. (it does not work with
Text Mesh Pro)
";

      customInspector.inspectField.floatIntField_slider_Style0(textDPI, "Text DPI", description, 0.1f, 4f);
    }

    public static void fixedDpiField()
    {
      string description = @"
Current image resolution. If “dynamicResolutionSystem” is False,
then you can set this value to catch your desired FPS.
";

      customInspector.inspectField.floatIntField_slider_Style0(fixedDPI, "DPI", description, 0.3f, 1f);
    }

    public static void measurePeriodField()
    {
      string description = @"
For example, if this value is 2, per 2 seconds, WFA changes image
resolution according to the average FPS of the last 2 seconds if it is necessary.
  ";

      GUILayout.Space(15);

      customInspector.inspectField.floatIntField_Style0(measurePeriod, "Measure Period", description);
    }

    public static void dpiIncrementDecrementFields()
    {
      string description = @"
  Controls the speed of DPI increase-decrease, which occurs when
  FPS are above the fpsMax parameter.
  ";

      GUILayout.Space(15);

      customInspector.inspectField.floatIntField_slider_Style0(dpiIncrement, "DPI Increment", description, 0.01f, 0.25f);
      customInspector.inspectField.floatIntField_slider_Style0(dpiDecrement, "DPI Decrement", description, 0.01f, 0.25f);
    }

    public static void dpiRangeFields()
    {
      string description = @"
this setting allows you to decide the maximum-minimum image resolution.
  ";
      string title = "DPI Range";

      GUILayout.Space(10);

      customInspector.showTitleStyle0(title, description);
      customInspector.inspectField.floatIntField_slider_Style0(dpiMin, "Min", description, 0.3f, 1);
      customInspector.inspectField.floatIntField_slider_Style0(dpiMax, "Max", description, 0.3f, 1);
    }

    public static void targetFpsRangeFields()
    {
      string description = @"
Your desired target FPS range.
If you have 30 FPS while ""dynamicResolutionSystem"" is inactive, then maybe you could change ""fpsMin - fpsMax"" to 40-45...
  ";
      string title = "Target FPS Range";

      GUILayout.Space(10);

      customInspector.showTitleStyle0(title, description);
      customInspector.inspectField.floatIntField_slider_Style0(fpsMin, "Min", description, 15, 120);
      customInspector.inspectField.floatIntField_slider_Style0(fpsMax, "Max", description, 15, 120);
    }

    public static void dpiField()
    {
      string description = @"
  DPI (dots per inch): Current image resolution. If “dynamicResolutionSystem” is False,
  then you can set this value manually to catch your desired FPS.
  ";

      customInspector.inspectField.floatIntField_Style1(dpi, "DPI", description);
    }

    public static void logo(out float float0)
    {
      Texture2D logo = Resources.Load<Texture2D>("logo");

      float width = (Screen.height / 2160f) * 195f;
      float height = (Screen.height / 2160f) * 130;
      float x = (EditorGUIUtility.currentViewWidth / 2) - (width / 2);

      GUI.color = Color.white;
      GUI.DrawTexture(new Rect(x, 0, width, height), logo);

      float0 = width / 1.5f;
    }

    public static void drsOnOffButton()
    {
      string description = @"
      If this parameter is True then you can choose the desired
      FPS range and WFA will dynamically adjust DPI-resolution to match the best FPS
      according to the DPI range specified.
      ";

      customInspector.twoOptionsEnumOnOffButton_s
      (
        serializer: resolutionSystem,
        description: description,
        displayName: "Dynamic Resolution System"
      );
    }

    public static void downSamplingSystemField()
    {
      string description = @"
It gives two options;
RenderScale: If the project is using Universal Render Pipeline, then WFA will use the
“Render Scale” parameter of the render pipeline to adjust resolution. An advantage of
this method is that downsampling does not affect the UI objects. If the project is using
Built-in Render Pipeline, then WFA will use its own “Render Scale” parameter to adjust
resolution.
devicePixelRatio: The down sampling system which is using devicePixelRatio
parameter of the browser.
      ";

      customInspector.inspectField.enumField_Style0(downSamplingSystem, "downSamplingSystem", description);
    }

    public static void targetCameraField()
    {
      string description = @"
The target camera WFA will use for “Render Scale Down Sampling
System” for built-in render pipeline.
      ";

      customInspector.inspectField.objectField_Style0(targetCamera, "Target Camera", description);
    }
  }

  public static void help()
  {
    System.IO.DirectoryInfo directory = System.IO.Directory.GetParent(Application.dataPath);
    var folder = directory.ToString() + "/Assets";
    var filePath = wfaEditor.findFilePath(folder, "wfaDocumentation.pdf");

    System.Diagnostics.Process.Start(filePath);
  }

  public override void OnInspectorGUI()
  {
    run();
  }
}