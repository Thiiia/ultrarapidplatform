using System.Collections.Generic;
using UnityEngine;

public class SOEPrimeFinder : MonoBehaviour
{
    public int maxValue = 50;
    private HashSet<int> nonPrimes = new HashSet<int>();
    public HashSet<int> primes = new HashSet<int>();

    void Start()
    {
        FindPrimesUpTo(maxValue);
    }

    void FindPrimesUpTo(int n)
    {
        nonPrimes.Clear();
        primes.Clear();

        for (int x = 2; x < n; x++)
        {
            for (int y = x * 2; y < n; y += x)
            {
                nonPrimes.Add(y);
            }
        }

        for (int z = 2; z < n; z++)
        {
            if (!nonPrimes.Contains(z))
            {
                primes.Add(z);
            }
        }
    }

    public HashSet<int> GetMultiples(int factor)
    {
        HashSet<int> multiples = new HashSet<int>();
        for (int i = factor; i <= maxValue; i += factor)
        {
            multiples.Add(i);
        }
        return multiples;
    }
}
