# vplates

Originally:
https://www.npmjs.com/package/vplates/v/0.1.7

This was depricated and no longer worked and I can't find a repo to PR too.

a little program to check for license plate availability for plates in Victoria, Australia! (now with puppeteer)

## basic usage
running the program with a single argument will check for a single plate's availability
```
$ vplates test
'TEST' is unavailable
$ vplates t3st
'T3ST' is AVAILABLE!
```

## bulk checking
you can also do bulk numberplate availability checks

to do this, use the `--mode` argument!

### **file mode**
you can use a newline-separated list as an input to check each line for availability

```
$ vplates --mode file --file plates.txt
Getting available plates of 6 items
[==============================] 100% complete (6/6 - 2 available plates)
Done!
Available plates:
[ 'T3ST', 'TSTPL8' ]
```

### **combo mode**
the most interesting mode, `--mode combo`, allows you to test the availability of every combination of a set of characters at a set length

```
$ vplates -m combo --chars abcdefghijklmnopqrstuvwxyz --count 2
Generating every 2 character combination of the characters 'abcdefghijklmnopqrstuvwxyz'
Getting available plates of 676 items
[==============================] 100% complete (676/676 - 0 available plates)
Done!
None of those plates were available :(
```

the above command generates a list of every 2 character combination (`--count 2`) of the alphabet (`--chars abcdefghijklmnopqrstuvwxyz`), and checks those for availability. so it will check `AA,AB,AC,...ZX,ZY,ZZ`. 

in the absence of `--count` and `--chars` arguments, `--mode combo` will search for all 2-character alphanumeric combinations, which are desirable for use with the Signature plate style

in addition to the `--count` argument, you can use the `--countUp` argument to "count up" to the length defined using `--count`, essentially testing all combinations with the length of 2 to `count`

```
$ vplates -m combo --chars xyz --count 6 --countUp
Generating every 2-6 character combination of the characters 'xyz'
...
```

### queue size
you can use the `--queueSize` argument with any `--mode` to set the maximum number of concurrent requests being sent to the vplates API. it defaults to 200 which makes it fairly quick, but it can be lowered to reduce strain on the API

```
// will test combinations 1-by-1, instead of 200 at a time
$ vplates -m combo --queueSize 1
```

## saving results
it might be useful to output the results to a file, since the program only spits a certain number of results to stdout

you can output the resulting available plates of any bulk operation by using the `--output` argument

```
// will save a comma-separated list of available plates to available_plates.txt
$ vplates --mode combo --output available_plates.txt
```

you can also output the unavailable plates, if for whatever reason that's useful, by using the `--outputUnavailable` argument

```
// will save a comma-separated list of unavailable plates to unavailable_plates.txt
$ vplates --mode combo --outputUnavailable unavailable_plates.txt
```

## misc arguments

### `--showUnavailable`
is a flag that shows a list of the unavailable plates which were tested, alongside the list of available ones, when complete

### `--progUpdate [milliseconds]`
allows you to change the rate at which the displayed progress updates

defaults to 100 milliseconds

### `--progSize [length]`
allows you to change how many characters long the progress bar is

### `--progFill [char]` and `--progEmpty [char]`
allows you to change the characters used for the "filled" and "empty" parts of the progress bar

```
$ vplates -m combo --progSize 6 --progFill w --progEmpty . 
Generating every 2 character combination of the characters 'abcdefghijklmnopqrstuvwxyz0123456789'
Getting available plates of 1296 items
[ww....] 26% complete (348/1296 - 0 available plates)
```