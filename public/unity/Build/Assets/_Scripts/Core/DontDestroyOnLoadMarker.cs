using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class DontDestroyOnLoadMarker : MonoBehaviour
{
    void Awake()
    {
        DontDestroyOnLoad(gameObject);
    }
}
