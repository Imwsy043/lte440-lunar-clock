#!/usr/bin/env python3

"""
File
----
lte440.py

Demo file for calculating the LTE440 model using SPICE toolkit.

Input
-----
Input file name:
    lte440.in

Input file format:
    jd1, jd2
    ...
Normally jd1 and jd2 are the integer and fractional parts of the Julian Date,
to achieve better precision. Time scale is TDB.

In the demo input file, the epochs are T0+TDB0, 1600.0, 1700.0, 1800.0, 1900.0,
2000.0, 2100.0, and 2200.0:
    2443144.5,3.7249924189814814e-04
    2305445.0,0
    2341970.0,0
    2378495.0,0
    2415020.0,0
    2451545.0,0
    2488070.0,0
    2524595.0,0

Output
------
Output format:
    # JD              TCL-TCB                 TCL-TDB
    2451545.000000000 -1.0760479771816941e+01 +4.9330749643254862e-01
    ...
Three columns are Julian Date, TCL-TCB, and TCL-TDB respectively.

Author
------
Copyright (c) 2025, Lu Xu
"""

import spiceypy as spice

L_B = 1.550519768e-8    # L_B
J2000 = 2451545.0       # JD of J2000.0
TDB0 = -65.5e-6         # TDB0 in seconds
# Express t0 + tdb0 as jd1_0 + jd2_0, to achieve better precision
T0_JD1 = 2443144.5
T0_JD2 = 0.0003725 + TDB0 / 86400


def tclmtdb(jd1, jd2=0) -> tuple:
    frame = 'J2000'         # Reference frame
    abcorr = 'NONE'         # Aberration correction
    center = 1000000000     # Naif ID for the dummy center body
    # Get the Naif ID for TCL-TDB
    target = spice.bodn2c('TIME_TCLMTDB')

    # Convert jd to seconds from J2000.0
    et = ((jd1 - J2000) + (jd2 - 0)) * 86400

    # Function `spkez` returns ([X, Y, Z, VX, VY, VZ], light time)
    pv, lt = spice.spkez(target, et, frame, abcorr, center)
    # LTE data is in the X coordinate
    lte_periodic = pv[0]

    # Read drift rate from the PCK kernel, name is "BODY<target>_RATE"
    ndim, data = spice.bodvcd(target, "RATE", 1)
    # Returned data is an array with one element
    drift = data[0]

    # Calculate the total TCL-TCB
    dTDB = ((jd1 - T0_JD1) + (jd2 - T0_JD2)) * 86400
    tcl_tdb = lte_periodic + drift * dTDB

    return tcl_tdb


def tclmtcb(jd1, jd2=0) -> float:
    # Calculate the total TCB-TDB
    tcl_tdb = tclmtdb(jd1, jd2)
    dTDB = ((jd1 - T0_JD1) + (jd2 - T0_JD2)) * 86400
    tcl_tcb = tcl_tdb + TDB0 - L_B / (1 - L_B) * dTDB
    return tcl_tcb


if __name__ == "__main__":
    spice.furnsh(['lte440.bsp', 'lte440.tpc'])
    print("# JD              TCL-TCB                 TCL-TDB")
    for line in open('lte440.in'):
        # Input date is in jd1, jd2 pair format
        jd1, jd2 = [float(col.strip()) for col in line.split(',')]

        tcl_tcb = tclmtcb(jd1, jd2)
        tcl_tdb = tclmtdb(jd1, jd2)

        print(f"{jd1+jd2:.9f} {tcl_tcb:+.16e} {tcl_tdb:+.16e}")
