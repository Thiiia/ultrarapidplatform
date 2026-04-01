using UnityEditor;
using UnityEngine;
using static WFA.utilities.utilities0;
using static WFA.WebGLFPSAccelerator;
// WFA 2.0
[CreateAssetMenu]
public class wfaConfig : ScriptableObject
{
  public void saveData()
  {
#if UNITY_EDITOR
    if (!EditorApplication.isPlaying)
    {
      EditorUtility.SetDirty(this);
      AssetDatabase.SaveAssets();
      AssetDatabase.Refresh();
    }
#endif
  }

  public float _fixedDPI = 1f;
  public float fixedDPI
  {
    get
    {
      return _fixedDPI;
    }
    set
    {
      float _value = Mathf.Clamp(value, 0.3f, 1f);
      _fixedDPI = LeaveDigit(_value, 2);

      saveData();
    }
  }

  public float _DPI = 1;
  public float DPI
  {
    get
    {
      return _DPI;
    }
    set
    {
      if (resolutionSystem == WFA.WebGLFPSAccelerator.resolutionSystem._enum.dynamicResolutionSystem)
      {
        value = Mathf.Clamp(value, _dpiMin, _dpiMax);
      }

      value = LeaveDigit(value, 2);

      _DPI = value;

      saveData();
    }
  }

  public float _measurePeriod = 4f;
  public float measurePeriod
  {
    get
    {
      return _measurePeriod;
    }
    set
    {
      _measurePeriod = LeaveDigit(value, 2);

      saveData();
    }
  }

  public float _dpiDecrement = 0.050f;
  public float dpiDecrement
  {
    get
    {
      return _dpiDecrement;
    }
    set
    {
      float _value = Mathf.Clamp(value, 0.01f, 0.25f);
      _dpiDecrement = LeaveDigit(_value, 2);

      saveData();
    }
  }

  public float _dpiIncrement = 0.050f;
  public float dpiIncrement
  {
    get
    {
      return _dpiIncrement;
    }
    set
    {
      float _value = Mathf.Clamp(value, 0.01f, 0.25f);
      _dpiIncrement = LeaveDigit(_value, 2);

      saveData();
    }
  }

  public int _fpsMin = 30;
  public int fpsMin
  {
    get
    {
      return _fpsMin;
    }
    set
    {
      int _value = Mathf.Clamp(value, 15, _fpsMax);
      _fpsMin = _value;

      saveData();
    }
  }

  public int _fpsMax = 35;
  public int fpsMax
  {
    get
    {
      return _fpsMax;
    }
    set
    {
      int _value = Mathf.Clamp(value, _fpsMin, 120);
      _fpsMax = _value;

      saveData();
    }
  }

  public float _dpiMin = 0.3f;
  public float dpiMin
  {
    get
    {
      return _dpiMin;
    }
    set
    {
      float _value = Mathf.Clamp(value, 0.3f, dpiMax);
      _dpiMin = LeaveDigit(_value, 1);

      saveData();
    }
  }

  public float _dpiMax = 1f;
  public float dpiMax
  {
    get
    {
      return _dpiMax;
    }
    set
    {
      float _value = Mathf.Clamp(value, dpiMin, 1);
      _dpiMax = LeaveDigit(_value, 1);

      saveData();
    }
  }

  public float _textDPI = 1f;
  public float textDPI
  {
    get
    {
      return _textDPI;
    }
    set
    {
      value = Mathf.Clamp(value, 0.1f, 4f);
      value = LeaveDigit(value, 2);
      _textDPI = value;

      saveData();
    }
  }

  public WFA.WebGLFPSAccelerator.resolutionSystem._enum _resolutionSystem;
  public resolutionSystem._enum resolutionSystem
  {
    get
    {
      return _resolutionSystem;
    }
    set
    {
      _resolutionSystem = value;

      saveData();
    }
  }

  public downSamplingSystem._enum _downSamplingSystem;
  public downSamplingSystem._enum downSamplingSystem
  {
    get
    {
      return _downSamplingSystem;
    }
    set
    {
      _downSamplingSystem = value;

      saveData();
    }
  }

  public bool _showUI;
  public bool showUI
  {
    get
    {
      return _showUI;
    }
    set
    {
      _showUI = value;

      saveData();
    }
  }

  public FilterMode _filterMode;
  public FilterMode filterMode
  {
    get
    {
      return _filterMode;
    }
    set
    {
      _filterMode = value;

      saveData();
    }
  }
}