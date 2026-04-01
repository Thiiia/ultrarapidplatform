REQUIRED SETTINGS;
- Project Settings > Player > Other Settings > COLOR SPACE: Gamma (strongly recommended)

DEPENDENCIES FOR DEMO SCENE:
- Post Processing (To remove its dependency, just delete "ppManager.cs")
( Please install from Package Manager )


WebGL FPS Accelerator

What’s WebGL FPS Accelerator?
WebGL FPS Accelerator (WFA) is a “Dynamic Resolution System" and an advanced "DPI Control System" for WebGL that improves the FPS of your game. WebGL FPS Accelerator allows you to provide a balance between performance (FPS) and image quality (DPI).

How It Works?
Dynamic Resolution System allows you to dynamically adjust DPI-Render Scale, to reduce workload on the GPU. In cases where the application’s frame rate reduces, WFA will gradually scale down the resolution to maintain a consistent frame rate instead.

Quick Start
Add “webglFpsAcceleratorPrefab” to your scene. And That’s All! You can find this prefab in “Assets/WebGL FPS Accelerator”.

What’s Next?
You can set the target FPS range with parameters “fpsMax” and “fpsMin” on the inspector or on in-game UI. The system will set DPI-resolution to catch this FPS range dynamically.


Description of WebGL FPS Accelerator Parameters

* dynamicResolutionSystem: If this parameter is True then you can choose the desired FPS range and WFA will dynamically adjust DPI-resolution to match the best FPS according to the DPI range specified.
* DPI (dots per inch): Current image resolution. If “dynamicResolutionSystem” is False, then you can set this value to catch your desired FPS.
* Target FPS Range (fpsMin-fpsMax): Your desired target FPS range.
* dpiDecrement: Controls the speed of DPI decrease, which occurs when FPS are below the fpsMin parameter.
* dpiIncrement: Controls the speed of DPI increase, which occurs when FPS are above the fpsMax parameter.
* dpiMin: this setting allows you to decide the minimum image resolution.
* dpiMax: this setting allows you to decide the maximum image resolution.
* Measure Period: For example, if this value is 2, per 2 seconds, WFA changes image resolution according to the average FPS of the last 2 seconds if it is necessary.
* downSamplingSystem: It gives two options;
  RenderScale: If the project is using Universal Render Pipeline, then WFA will use the “Render Scale” parameter of the render pipeline to adjust resolution. An advantage of this method is that downsampling does not affect the UI objects. If the project is using Built-in Render Pipeline, then WFA will use its own “Render Scale” parameter to adjust resolution.
  devicePixelRatio: The down sampling system which is using devicePixelRatio parameter of the browser.
* MainData: WFA uses a “Configuration Data” which allows users to configure WFA parameters. by default WFA uses “wfaConfigDefault.asset” file in “Resources” directory. You can create your own Config Data; “Assets > Create > Wfa Config”  then you should put it to this parameter “MainData”.
* textDPI: Use this parameter if you want to adjust Text Resolution. (it does not work with Text Mesh Pro)
* showUI: Make this “true” if you want to use in-game UI to adjust parameters of WFA.      IF IT IS “FALSE”, THE UI WILL NEVER BE CREATED AND ANY CODE WILL WORK ABOUT THIS.       So you don’t need to worry about performance issues.
* targetCamera: The target camera WFA will use for “Render Scale Down Sampling System” for built-in render pipeline. 


FAQ (Frequently Asked Questions)

* Why am I getting errors about "Post Processing"?
You need to install these packages for only Demo Scene. To remove its dependency, just delete "ppManager.cs". These solutions will fix errors.

* What happens if I keep the fpsMin and fpsMax settings very close together?
It depends on "dpiIncreament-dpiDecrement". For example, if dpiIncrease is "1", and if this amount changes FPS more than 5 fps (e.g. 7), then the difference of fpsMin and fpsMax parameters could be 7 or 8. Because if the target FPS range is smaller than 7 (e.g. 30-32), then the plugin cannot enter that range sometimes, and it has to work forever with a loop of increasing-decreasing. For example, if the current FPS is 28, after DPI increase it can be 35 with extra 7 FPS, but this time, plugin will try to decrease DPI again because 35 is bigger than 30-32 range, and FPS will be 28 again, and the plugin will try to increase DPI again. This can make a loop forever. AND THIS MAY CAUSE GETTING SPIKES AND DROPS.

* How Can I Hide In-Game UI?
Make the “showUI” parameter “false”. IF IT IS “FALSE”, THE UI WILL NEVER BE CREATED AND ANY CODE WILL WORK ABOUT THIS. So you don’t need to worry about performance issues.

* The frame rate is the same with the asset or without. What is the problem?
- If your frame rate is in "target fps range", the plugin will not do anything. Try to change fpsMin-fpsMax parameters.
- You can disable "dynamic resolution" mode, and you can change DPI manually, to see if there is a difference. You should see downsampling on resolution. If you see down sampling but no difference on Frame Rate, you can try on different devices. If the graphics performance of the device is good or your project has low FPS because of the "CPU load", you may not see much difference.



Additional Support & Questions
This works only on WEBGL BUILDS. NOT ON EDITOR. So build your project to test.
If you have any issue using WFA, please send an email to agnosia.developer@outlook.com