// This code is a part of MagicCap which is a MPL-2.0 licensed project.
// Copyright (C) Jake Gealer <jake@gealer.email> 2019.

package main

import (
	"github.com/kbinani/screenshot"
	"image/png"
	"image"
	"os"
	"strconv"
	"fmt"
	"bytes"
	"sort"
)
import b64 "encoding/base64"

func main() {
	n := screenshot.NumActiveDisplays()
	all_displays := make([]image.Rectangle, 0)

	for i := 0; i < n; i++ {
		all_displays = append(all_displays, screenshot.GetDisplayBounds(i))
	}

	sort.Slice(all_displays, func(a, b int) bool {
		return all_displays[a].Min.X < all_displays[b].Min.X
	})

	argsWithoutProg := os.Args[1:]

	if len(argsWithoutProg) != 1 {
		panic("Invalid length")
	}

	display_id, _ := strconv.Atoi(argsWithoutProg[0])

	img, err := screenshot.CaptureRect(all_displays[display_id])
	if err != nil {
		panic(err)
	}

	buf := new(bytes.Buffer)
	png.Encode(buf, img)

	fmt.Printf("%s", b64.StdEncoding.EncodeToString(buf.Bytes()))
}
