using System.Collections;
using System.Collections.Generic;
using UnityEngine;

//Gotta initialise the namespace!!
using ChartLoader.NET.Utils;
using ChartLoader.NET.Framework;
public class chartLoaderScript : MonoBehaviour
{
    public static ChartReader chartReader;

    public Transform[] notePrefabs;
    // Start is called before the first frame update
    void Start()
    {
        chartReader = new ChartReader();
        //Reading Papercut Chart File
        Chart papercutChart = chartReader.ReadChartFile("D:\\Daddy\\Documents\\Work\\Ultra Rapid Repo\\ULTRARAPID-MVP-Main\\Assets\\Sound\\Music\\Charts\\Papercut.chart"); 
        Note[] normalSingleNotes = papercutChart.GetNotes("MediumSingle");
        SpawnNotes(normalSingleNotes);
    }
    //General note spawner
    public void SpawnNotes(Note[] notes)
    {
        foreach (Note note in notes)
        {
            SpawnNote(note);
        }
    }
    // Spawns a singular note
    public void SpawnNote (Note note)
    {
        Vector3 point;
        for(int i = 0; i < note.ButtonIndexes.Length; i++)
        {
            if (note.ButtonIndexes[i])
            {
                point = new Vector3(i-2f, 0f, note.Seconds);
                //Instantiate note via button position by the increment of 2
                SpawnPrefab(notePrefabs[i], point);
            }
           
        }

    }
    // Spawns a prefab.
    public void SpawnPrefab(Transform prefab, Vector3 point)
    {
        Transform tmp = Instantiate(prefab);
        tmp.SetParent(transform);
        tmp.position = point;
    }


    // Update is called once per frame
    void Update()
    {
        
    }
}
